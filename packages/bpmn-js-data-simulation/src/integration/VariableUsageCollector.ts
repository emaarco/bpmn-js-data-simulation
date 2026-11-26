import type { ElementVariableUsage } from '../domain/model.js'
import type { EngineAdapter } from '../engines/types.js'
import { elementName, is } from '../utils/diagramElements.js'
import type { DiagramElement } from './tokenSimulation.js'

export class VariableUsageCollector {
  constructor(private readonly engine: EngineAdapter) {}

  collect(container: DiagramElement): ElementVariableUsage[] {
    const usages: ElementVariableUsage[] = []
    const visit = (element: DiagramElement): void => {
      if (element.type === 'label') return
      const usage = this.usageOf(element)
      if (usage) usages.push(usage)
      element.children?.forEach(visit)
    }
    container.children?.forEach(visit)
    return usages
  }

  private usageOf(element: DiagramElement): ElementVariableUsage | undefined {
    const businessObject = element.businessObject
    if (is(element, 'bpmn:SequenceFlow')) {
      const condition = this.engine.readCondition(businessObject)
      if (!condition) return undefined
      return this.usage(element.source ?? element, { conditionReads: this.engine.readVariableNames(condition) })
    }
    if (!is(element, 'bpmn:FlowNode')) return undefined
    const { inputs, outputs } = this.engine.readIoMappings(businessObject)
    const loop = this.engine.readLoop?.(businessObject)
    const readOnEnter = [loop?.cardinality, loop?.collection, ...inputs.map(mapping => mapping.source)]
    return this.usage(element, {
      inputReads: readOnEnter.flatMap(expression => (expression ? this.engine.readVariableNames(expression) : [])),
      inputTargets: inputs.map(mapping => mapping.target),
      outputReads: outputs.flatMap(mapping => this.engine.readVariableNames(mapping.source)),
      outputTargets: outputs.map(mapping => mapping.target),
    })
  }

  private usage(element: DiagramElement, reads: Partial<ElementVariableUsage>): ElementVariableUsage {
    return {
      elementName: elementName(element),
      conditionReads: [],
      inputReads: [],
      inputTargets: [],
      outputReads: [],
      outputTargets: [],
      ...reads,
    }
  }
}
