import type { Mapping, Variables } from '../domain/model.js'
import type { EngineAdapter } from '../engines/types.js'
import type { DataSimulationStore } from '../simulation/DataSimulationStore.js'
import { elementName } from '../utils/diagramElements.js'
import { withoutKeys } from '../utils/variables.js'
import type { DiagramElement } from './tokenSimulation.js'

export class IoMappings {
  constructor(
    private readonly engine: EngineAdapter,
    private readonly store: DataSimulationStore,
  ) {}

  apply(element: DiagramElement, instanceId: string): void {
    const inputs = this.engine.readInputMappings(element.businessObject)
    const outputs = this.engine.readOutputMappings(element.businessObject)
    const taskResult = this.store.getTaskResult(instanceId, element.id)
    if (!inputs.length && !outputs.length && !taskResult) return

    const processVariables = this.store.getVariables(instanceId)
    const localVariables = this.evaluate(element, instanceId, inputs, {}, current => ({
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
      this.evaluate(element, instanceId, outputs, withTaskResult, () => context),
    )
  }

  private evaluate(
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
