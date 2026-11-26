import type { OutgoingFlow } from '../domain/model.js'
import type { EngineAdapter } from '../engines/types.js'
import { readConditionExpression } from './moddle.js'
import type { DiagramElement, ElementRegistry, Scope } from '../integration/tokenSimulation.js'

export function findProcessInstance(scope: Scope): Scope {
  let current = scope
  while (current.parent) current = current.parent
  return current
}

export function isLoopInstance(scope: Scope): boolean {
  return scope.parent?.element === scope.element
}

export function elementName(element: DiagramElement): string {
  const name = element.businessObject.name
  return typeof name === 'string' && name.trim() ? name.trim() : element.id
}

export function is(element: DiagramElement, type: string): boolean {
  const businessObject = element.businessObject as { $instanceOf?: (type: string) => boolean }
  return typeof businessObject?.$instanceOf === 'function' && businessObject.$instanceOf(type)
}

export function flowNodesOf(elementRegistry: ElementRegistry): DiagramElement[] {
  return elementRegistry.filter(element => element.id === element.businessObject.id && is(element, 'bpmn:FlowNode'))
}

export function isGateway(element: DiagramElement): boolean {
  return element.type === 'bpmn:ExclusiveGateway' || element.type === 'bpmn:InclusiveGateway'
}

export function decidingElementOf(element: DiagramElement): string | undefined {
  return element.type === 'bpmn:SequenceFlow' ? element.source?.id : element.id
}

export type ActivityRouting = 'none' | 'by-conditions' | 'refused'

export function activityRouting(activity: DiagramElement, engine: EngineAdapter): ActivityRouting {
  if (!is(activity, 'bpmn:Activity')) return 'none'
  const conditional = outgoingSequenceFlows(activity).filter(flow => readConditionExpression(flow.businessObject))
  if (engine.activityConditionRefusal) return conditional.length ? 'refused' : 'none'
  if (!conditional.length && !activity.businessObject.default) return 'none'
  const evaluable = conditional.every(flow => {
    const expression = engine.readCondition(flow.businessObject)
    return expression !== undefined && engine.canEvaluate(expression)
  })
  return evaluable ? 'by-conditions' : 'none'
}

export function outgoingSequenceFlows(element: DiagramElement): DiagramElement[] {
  return (element.outgoing ?? []).filter(flow => is(flow, 'bpmn:SequenceFlow'))
}

export function readOutgoingFlow(sequenceFlow: DiagramElement, engine: EngineAdapter): OutgoingFlow {
  const name = sequenceFlow.businessObject.name
  return {
    id: sequenceFlow.id,
    ...(typeof name === 'string' && name ? { name } : {}),
    expression: engine.readCondition(sequenceFlow.businessObject),
    isDefault: sequenceFlow.source?.businessObject.default === sequenceFlow.businessObject,
  }
}
