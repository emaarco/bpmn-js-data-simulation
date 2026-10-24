import type { EngineId } from '@emaarco/bpmn-js-data-simulation'

export const ZEEBE_NAMESPACE = 'http://camunda.org/schema/zeebe/1.0'
const CAMUNDA_NAMESPACE = 'http://camunda.org/schema/1.0/bpmn'

export function detectEngine(xml: string): EngineId {
  if (xml.includes(ZEEBE_NAMESPACE)) return 'zeebe'
  if (xml.includes(CAMUNDA_NAMESPACE)) return 'camunda7'
  return 'zeebe'
}
