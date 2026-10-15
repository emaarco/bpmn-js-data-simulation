import type { ModdleElement } from './types.js'

export function findExtension(element: ModdleElement, type: string): ModdleElement | undefined {
  const extensionElements = element.extensionElements as { values?: ModdleElement[] } | undefined
  return extensionElements?.values?.find(value => value.$type === type)
}

export function listProperty(element: ModdleElement | undefined, property: string): ModdleElement[] {
  const value = element?.[property]
  return Array.isArray(value) ? (value as ModdleElement[]) : []
}

export function readConditionExpression(sequenceFlow: ModdleElement): { body?: string; language?: string } | undefined {
  const condition = sequenceFlow.conditionExpression as ModdleElement | undefined
  if (!condition) return undefined
  return {
    body: typeof condition.body === 'string' ? condition.body : undefined,
    language: typeof condition.language === 'string' ? condition.language : undefined,
  }
}
