import type { DiagramElement, Scope } from '../integration/tokenSimulation.js'

export function findProcessInstance(scope: Scope): Scope {
  let current = scope
  while (current.parent) current = current.parent
  return current
}

export function elementName(element: DiagramElement): string {
  const name = element.businessObject.name
  return typeof name === 'string' && name.trim() ? name.trim() : element.id
}

export function is(element: DiagramElement, type: string): boolean {
  const businessObject = element.businessObject as { $instanceOf?: (type: string) => boolean }
  return typeof businessObject?.$instanceOf === 'function' && businessObject.$instanceOf(type)
}

export function isGateway(element: DiagramElement): boolean {
  return element.type === 'bpmn:ExclusiveGateway' || element.type === 'bpmn:InclusiveGateway'
}

export function gatewayOf(element: DiagramElement): string | undefined {
  if (isGateway(element)) return element.id
  if (element.type === 'bpmn:SequenceFlow' && element.source && isGateway(element.source)) return element.source.id
  return undefined
}
