import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { BpmnModdle } from 'bpmn-moddle'
import camundaModdle from 'camunda-bpmn-moddle/resources/camunda.json'
import zeebeModdle from 'zeebe-bpmn-moddle/resources/zeebe.json'
import type { EngineId, ModdleElement } from '../../src/engines/types'

const MODDLE_EXTENSIONS: Record<EngineId, Record<string, unknown>> = {
  zeebe: { zeebe: zeebeModdle },
  camunda7: { camunda: camundaModdle },
}

export function readFixture(name: string): string {
  return readFileSync(resolve(process.cwd(), 'test/fixtures', name), 'utf8')
}

export async function parseDefinitions(xml: string, engine: EngineId): Promise<ModdleElement> {
  const moddle = new BpmnModdle(MODDLE_EXTENSIONS[engine])
  const { rootElement, warnings } = await moddle.fromXML(xml)
  if (warnings.length) throw new Error(warnings.map(warning => warning.message).join('\n'))
  return rootElement as unknown as ModdleElement
}

export async function loadFlowElements(name: string, engine: EngineId): Promise<Map<string, ModdleElement>> {
  const definitions = await parseDefinitions(readFixture(name), engine)
  const [process] = definitions.rootElements as ModdleElement[]
  const flowElements = process.flowElements as ModdleElement[]
  return new Map(flowElements.map(element => [element.id as string, element]))
}
