import type { Variables } from '../domain/model.js'
import { ScenarioParser } from '../domain/ScenarioParser.js'
import { EngineRegistry } from '../engines/EngineRegistry.js'
import type { EngineAdapter, EngineId } from '../engines/types.js'
import type { DataSimulationStore, SimulationListener, SimulationSnapshot } from '../simulation/DataSimulationStore.js'
import type { StartFormRenderer } from '../ui/startForm.js'
import { elementName, findProcessInstance, is } from '../utils/diagramElements.js'
import { IoMappings } from './IoMappings.js'
import {
  DATA_TOGGLE_EVENT,
  type DiagramElement,
  type EventBus,
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
  private readonly ioMappings: IoMappings
  private readonly scenarioParser = new ScenarioParser()
  private enabled: boolean

  constructor(
    config: DataSimulationConfig | undefined,
    private readonly eventBus: EventBus,
    private readonly store: DataSimulationStore,
  ) {
    this.engine = new EngineRegistry().resolve(config?.engine ?? 'zeebe')
    this.ioMappings = new IoMappings(this.engine, store)
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
    this.store.setScenarios(this.scenarioParser.parse(input))
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
    if (this.store.hasInstance(instanceId)) this.ioMappings.apply(element, instanceId)
  }
}
