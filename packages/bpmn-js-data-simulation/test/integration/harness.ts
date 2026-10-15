import SimulatorModule from 'bpmn-js-token-simulation/lib/simulator'
import { Injector } from 'didi'
import EventBus from 'diagram-js/lib/core/EventBus'
import { vi } from 'vitest'
import DataSimulationModule from '../../src'
import type { EngineId, ModdleElement } from '../../src/engines/types'
import type { DataSimulation } from '../../src/integration/DataSimulation'
import { parseDefinitions, readFixture } from '../engines/moddle'

interface TestElement {
  id: string
  type: string
  businessObject: ModdleElement
  [property: string]: any
}

export interface Harness {
  dataSimulation: DataSimulation
  simulator: any
  overlays: { add: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn> }
  entered: string[]
  eventBus: any
  injector: Injector
  markers(id: string): string[]
  container: HTMLElement
  get(id: string): TestElement
  trigger(elementId: string): void
}

export async function createHarness(xml: string, engine: EngineId, scenarios?: unknown): Promise<Harness> {
  const elements = buildElements(await parseDefinitions(xml, engine))
  const elementRegistry = {
    get: (id: string) => elements.get(id),
    forEach: (callback: (element: TestElement) => void) => elements.forEach(element => callback(element)),
    filter: (callback: (element: TestElement) => boolean) => [...elements.values()].filter(callback),
  }
  const overlays = { add: vi.fn(() => 'overlay'), remove: vi.fn() }
  const markers = new Map<string, Set<string>>()
  const container = document.createElement('div')
  const canvas = {
    getContainer: () => container,
    getAbsoluteBBox: ({ x = 0, y = 0, width = 0, height = 0 }: TestElement) => ({ x, y, width, height }),
    addMarker: (element: TestElement, marker: string) =>
      markers.set(element.id, new Set([...(markers.get(element.id) ?? []), marker])),
    removeMarker: (element: TestElement, marker: string) => markers.get(element.id)?.delete(marker),
  }
  const injector = new Injector([
    {
      eventBus: ['type', EventBus],
      elementRegistry: ['value', elementRegistry],
      overlays: ['value', overlays],
      canvas: ['value', canvas],
      'config.dataSimulation': ['value', { engine, scenarios }],
    },
    SimulatorModule,
    { ...DataSimulationModule, __init__: ['dataSimulation', 'dataSimulationOverlays', 'dataGatewayBehaviors'] },
  ] as any)
  injector.init()

  const eventBus = injector.get<any>('eventBus')
  const simulator = injector.get<any>('simulator')
  const entered: string[] = []
  eventBus.on('tokenSimulation.simulator.trace', (event: { action: string; element: TestElement }) => {
    if (event.action === 'enter') entered.push(event.element.id)
  })
  eventBus.fire('tokenSimulation.toggleMode', { active: true })

  return {
    dataSimulation: injector.get('dataSimulation'),
    simulator,
    overlays,
    entered,
    eventBus,
    injector,
    container,
    markers: id => [...(markers.get(id) ?? [])],
    get: id => elements.get(id)!,
    trigger(elementId) {
      const subscription = simulator.findSubscription({ element: elements.get(elementId) })
      if (!subscription) throw new Error(`Nothing to trigger at ${elementId}`)
      simulator.trigger({ event: subscription.event, scope: subscription.scope })
    },
  }
}

export function harnessFor(fixture: string, engine: EngineId, scenarios?: unknown): Promise<Harness> {
  return createHarness(readFixture(fixture), engine, scenarios)
}

function buildElements(definitions: ModdleElement): Map<string, TestElement> {
  const elements = new Map<string, TestElement>()

  function addShape(businessObject: ModdleElement, parent: TestElement | null): TestElement {
    const element: TestElement = {
      id: businessObject.id as string,
      type: businessObject.$type,
      businessObject,
      di: { isExpanded: true },
      parent,
      children: [],
      incoming: [],
      outgoing: [],
      attachers: [],
    }
    elements.set(element.id, element)
    parent?.children.push(element)
    const flowElements = (businessObject.flowElements as ModdleElement[] | undefined) ?? []
    flowElements.filter(child => child.$type !== 'bpmn:SequenceFlow').forEach(child => addShape(child, element))
    flowElements.filter(child => child.$type === 'bpmn:SequenceFlow').forEach(flow => addConnection(flow, element))
    return element
  }

  function addConnection(businessObject: ModdleElement, parent: TestElement): void {
    const source = elements.get((businessObject.sourceRef as ModdleElement).id as string)!
    const target = elements.get((businessObject.targetRef as ModdleElement).id as string)!
    const connection: TestElement = {
      id: businessObject.id as string,
      type: businessObject.$type,
      businessObject,
      parent,
      source,
      target,
      waypoints: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
    }
    elements.set(connection.id, connection)
    parent.children.push(connection)
    source.outgoing.push(connection)
    target.incoming.push(connection)
  }

  for (const rootElement of definitions.rootElements as ModdleElement[]) {
    if (rootElement.$type === 'bpmn:Process') addShape(rootElement, null)
  }
  return elements
}
