import type { Mapping, Variables } from '../domain/model.js'
import { parseScenarios } from '../domain/scenario.js'
import { resolveEngine } from '../engines/index.js'
import type { EngineAdapter, EngineId } from '../engines/types.js'
import type { DataSimulationStore, SimulationListener, SimulationSnapshot } from '../simulation/DataSimulationStore.js'
import type { StartFormRenderer } from '../ui/startForm.js'
import {
  DATA_TOGGLE_EVENT,
  type DiagramElement,
  elementName,
  type EventBus,
  findProcessInstance,
  is,
  RESET_SIMULATION_EVENT,
  SCOPE_CREATE_EVENT,
  SCOPE_DESTROYED_EVENT,
  type Scope,
  TOGGLE_MODE_EVENT,
  TRACE_EVENT,
} from './tokenSimulation.js'

export interface DataSimulationConfig {
  engine?: EngineId | EngineAdapter
  scenarios?: unknown
  startFormRenderer?: StartFormRenderer
  enabled?: boolean
}

export class DataSimulation {
  static $inject = ['config.dataSimulation', 'eventBus', 'dataSimulationStore']

  private readonly engine: EngineAdapter
  private enabled: boolean

  constructor(
    config: DataSimulationConfig | undefined,
    private readonly eventBus: EventBus,
    private readonly store: DataSimulationStore,
  ) {
    this.engine = resolveEngine(config?.engine ?? 'zeebe')
    this.enabled = config?.enabled ?? true
    this.store.setEngine(this.engine.label, this.engine.expressionLanguage)
    if (config?.scenarios !== undefined) this.setScenarios(config.scenarios)

    eventBus.on(SCOPE_CREATE_EVENT, ({ scope }: { scope: Scope }) => this.onScopeCreated(scope))
    eventBus.on(SCOPE_DESTROYED_EVENT, ({ scope }: { scope: Scope }) => {
      this.store.completeInstance(scope.id)
      this.store.removeWaiting(scope.id)
    })
    eventBus.on(TRACE_EVENT, (event: { action: string; element: DiagramElement; scope: Scope }) => {
      if (event.action === 'exit') this.applyMappings(event.element, event.scope)
    })
    eventBus.on([RESET_SIMULATION_EVENT, TOGGLE_MODE_EVENT], () => this.store.reset())
  }

  getEngine(): EngineAdapter {
    return this.engine
  }

  isEnabled(): boolean {
    return this.enabled
  }

  setEnabled(enabled: boolean): void {
    if (enabled === this.enabled) return
    this.enabled = enabled
    this.store.reset()
    this.eventBus.fire(DATA_TOGGLE_EVENT, { enabled })
  }

  setScenarios(input: unknown): void {
    this.store.setScenarios(parseScenarios(input))
  }

  selectScenario(scenarioId: string | null): void {
    this.store.selectScenario(scenarioId)
  }

  setStartVariables(variables: Variables): void {
    this.store.setStartVariables(variables)
  }

  selectInstance(instanceId: string): void {
    this.store.selectInstance(instanceId)
  }

  setInstanceVariables(instanceId: string, variables: Variables): void {
    this.store.setVariables(instanceId, variables)
  }

  getVariables(scope: Scope): Variables {
    return this.store.getVariables(findProcessInstance(scope).id)
  }

  getSnapshot(): SimulationSnapshot {
    return this.store.getSnapshot()
  }

  subscribe(listener: SimulationListener): () => void {
    return this.store.subscribe(listener)
  }

  private onScopeCreated(scope: Scope): void {
    if (!this.enabled || scope.parent || (!is(scope.element, 'bpmn:Process') && !is(scope.element, 'bpmn:Participant')))
      return
    this.store.startInstance(scope.id, elementName(scope.element))
  }

  private applyMappings(element: DiagramElement, scope: Scope): void {
    if (!is(element, 'bpmn:FlowNode') || scope.failed || scope.canceled) return
    const instanceId = findProcessInstance(scope).id
    if (!this.store.hasInstance(instanceId)) return

    const inputs = this.engine.readInputMappings(element.businessObject)
    const outputs = this.engine.readOutputMappings(element.businessObject)
    const taskResult = this.store.getTaskResult(instanceId, element.id)
    if (!inputs.length && !outputs.length && !taskResult) return

    const processVariables = this.store.getVariables(instanceId)
    const localVariables = this.evaluateMappings(element, instanceId, inputs, {}, current => ({
      ...processVariables,
      ...current,
    }))
    const context = { ...processVariables, ...localVariables, ...taskResult }

    const propagatesTaskResult = taskResult && (this.engine.taskResultPropagation === 'always' || !outputs.length)
    const withTaskResult = propagatesTaskResult
      ? { ...processVariables, ...withoutKeys(taskResult, Object.keys(localVariables)) }
      : processVariables
    this.store.setVariables(
      instanceId,
      this.evaluateMappings(element, instanceId, outputs, withTaskResult, () => context),
    )
  }

  private evaluateMappings(
    element: DiagramElement,
    instanceId: string,
    mappings: Mapping[],
    target: Variables,
    contextOf: (current: Variables) => Variables,
  ): Variables {
    let result = target
    for (const mapping of mappings) {
      const evaluation = this.engine.evaluate(mapping.source, contextOf(result))
      if (evaluation.ok) {
        result = this.engine.writeVariable(result, mapping.target, evaluation.value)
      } else {
        this.store.record({
          kind: 'mapping-issue',
          instanceId,
          elementId: element.id,
          elementName: elementName(element),
          target: mapping.target,
          reason: evaluation.reason,
        })
      }
    }
    return result
  }
}

function withoutKeys(variables: Variables, keys: string[]): Variables {
  return Object.fromEntries(Object.entries(variables).filter(([key]) => !keys.includes(key)))
}
