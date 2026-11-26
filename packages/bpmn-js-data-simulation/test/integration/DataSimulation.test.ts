// @vitest-environment jsdom
import SimulatorModule from 'bpmn-js-token-simulation/lib/simulator'
import { Injector } from 'didi'
import EventBus from 'diagram-js/lib/core/EventBus'
import { describe, expect, it, vi } from 'vitest'
import { DataSimulationModule, PathSimulationModule } from '../../src'
import type { DataSimulation } from '../../src/integration/DataSimulation'
import type { PathSimulation } from '../../src/integration/PathSimulation'
import type { DataStartForm } from '../../src/integration/DataStartForm'
import type { DecisionLogEntry, MappingIssueLogEntry } from '../../src/simulation/DataSimulationStore'
import { createHarness, type Harness, harnessFor } from './harness'
import { orderScenarios } from './scenarios'
import { readFixture } from '../engines/moddle'

const fixtures = [
  ['zeebe', 'order-zeebe.bpmn'],
  ['camunda7', 'order-camunda7.bpmn'],
] as const

describe.each(fixtures)('data simulation with %s', (engine, fixture) => {
  it('runs a scenario: output mappings write variables and gateways follow the data', async () => {
    const harness = await harnessFor(fixture, engine, orderScenarios)
    harness.trigger('startEvent_orderReceived')

    expect(harness.entered).toEqual(
      expect.arrayContaining([
        'serviceTask_checkCredit',
        'gateway_credit',
        'serviceTask_ship',
        'serviceTask_insurance',
        'serviceTask_accessories',
      ]),
    )
    expect(harness.entered).not.toContain('userTask_review')
    expect(lastEntered(harness)).toBe('endEvent_shipped')

    const [instance] = harness.dataSimulation.getSnapshot().instances
    expect(instance).toMatchObject({ processName: 'Order fulfilment', status: 'completed' })
    expect(instance.variables).toMatchObject({
      customer: { id: 'C-1' },
      orderTotal: 1200,
      insurance: true,
      accessories: ['lock'],
      creditScore: 720,
      creditworthy: true,
    })
    expect(instance.variables).not.toHaveProperty('customerId')
    expect(harness.dataSimulation.getSnapshot().log).toContainEqual(
      expect.objectContaining({
        elementId: 'gateway_credit',
        inputs: [
          { name: 'creditworthy', value: true },
          { name: 'orderTotal', value: 1200 },
        ],
      }),
    )
  })

  it('merges task results into the process when the task has no output mappings', async () => {
    const harness = await harnessFor(fixture, engine, orderScenarios)
    harness.dataSimulation.selectScenario('large-order')
    harness.trigger('startEvent_orderReceived')

    expect(harness.entered).toEqual(expect.arrayContaining(['userTask_review', 'gateway_approved', 'serviceTask_ship']))
    expect(harness.entered).not.toContain('serviceTask_insurance')
    expect(harness.entered).toContain('endEvent_shipped')
    expect(harness.dataSimulation.getSnapshot().instances[0].variables).toMatchObject({ approved: true })
  })

  it('takes the default flow when no condition is true', async () => {
    const harness = await harnessFor(fixture, engine, orderScenarios)
    harness.dataSimulation.selectScenario('bad-credit')
    harness.trigger('startEvent_orderReceived')

    expect(lastEntered(harness)).toBe('endEvent_rejected')
    const decision = harness.dataSimulation.getSnapshot().log[0] as DecisionLogEntry
    expect(decision).toMatchObject({ kind: 'decision', elementId: 'gateway_credit', elementName: 'Credit OK?' })
    expect(decision.decision.flows.map(flow => [flow.flow.id, flow.outcome])).toEqual([
      ['flow_approved', 'not-taken'],
      ['flow_review', 'not-taken'],
      ['flow_rejected', 'taken'],
    ])
  })

  it('keeps the token at a gateway whose condition fails and continues after the data is fixed', async () => {
    const harness = await harnessFor(fixture, engine, orderScenarios)
    harness.dataSimulation.selectScenario('missing-total')
    harness.trigger('startEvent_orderReceived')

    expect(harness.entered).not.toContain('endEvent_shipped')
    expect(isMarkedStuck(harness, 'gateway_credit')).toBe(true)
    const [instance] = harness.dataSimulation.getSnapshot().instances
    expect(instance).toMatchObject({ status: 'waiting', waiting: [{ gatewayId: 'gateway_credit' }] })

    harness.dataSimulation.setInstanceVariables(instance.id, { ...instance.variables, orderTotal: 99 })
    harness.trigger('gateway_credit')

    expect(lastEntered(harness)).toBe('endEvent_shipped')
    expect(harness.dataSimulation.getSnapshot().instances[0].status).toBe('completed')
    expect(isMarkedStuck(harness, 'gateway_credit')).toBe(false)
  })

  it('logs output mappings that cannot be evaluated', async () => {
    const harness = await harnessFor(fixture, engine, orderScenarios)
    harness.dataSimulation.selectScenario('no-credit-result')
    harness.trigger('startEvent_orderReceived')

    const issues = harness.dataSimulation
      .getSnapshot()
      .log.filter((entry): entry is MappingIssueLogEntry => entry.kind === 'mapping-issue')
    expect(issues.map(issue => issue.target)).toEqual(['creditScore', 'creditworthy'])
    expect(harness.entered).not.toContain('endEvent_shipped')
  })

  it('starts on demand from the edited start variables without a scenario', async () => {
    const harness = await harnessFor(fixture, engine)
    harness.dataSimulation.setStartVariables({
      customer: { id: 'C-9' },
      orderTotal: 10,
      insurance: false,
      accessories: [],
      score: 900,
    })
    harness.trigger('startEvent_orderReceived')

    expect(harness.entered).toContain('serviceTask_ship')
    expect(lastEntered(harness)).toBe('endEvent_shipped')
  })

  it('takes task results from the scenario the instance was started with', async () => {
    const harness = await harnessFor(fixture, engine, orderScenarios)
    harness.simulator.waitAtElement(harness.get('serviceTask_checkCredit'))
    harness.trigger('startEvent_orderReceived')
    harness.dataSimulation.selectScenario('bad-credit')
    harness.trigger('serviceTask_checkCredit')

    expect(harness.dataSimulation.getSnapshot().instances[0].variables).toMatchObject({ creditScore: 720 })
    expect(lastEntered(harness)).toBe('endEvent_shipped')
  })

  it('clears instances and the log on reset', async () => {
    const harness = await harnessFor(fixture, engine, orderScenarios)
    harness.trigger('startEvent_orderReceived')
    harness.eventBus.fire('tokenSimulation.resetSimulation')

    expect(harness.dataSimulation.getSnapshot()).toMatchObject({ instances: [], log: [] })
  })
})

describe('task results next to output mappings', () => {
  const scenarios = {
    scenarios: [
      {
        id: 'extra',
        variables: { customer: { id: 'C-1' }, orderTotal: 10, insurance: false, accessories: [] },
        taskResults: { serviceTask_checkCredit: { score: 720, ratingAgency: 'Schufa' } },
      },
    ],
  }

  it('Zeebe only keeps what the output mappings write', async () => {
    const harness = await harnessFor('order-zeebe.bpmn', 'zeebe', scenarios)
    harness.trigger('startEvent_orderReceived')

    expect(harness.dataSimulation.getSnapshot().instances[0].variables).not.toHaveProperty('ratingAgency')
  })

  it('Camunda 7 also propagates the completion variables', async () => {
    const harness = await harnessFor('order-camunda7.bpmn', 'camunda7', scenarios)
    harness.trigger('startEvent_orderReceived')

    expect(harness.dataSimulation.getSnapshot().instances[0].variables).toMatchObject({
      ratingAgency: 'Schufa',
      score: 720,
      creditScore: 720,
    })
  })
})

describe('start fields', () => {
  it('only skip the task results of the chosen scenario, so a process can start from scratch', async () => {
    const harness = await harnessFor('order-camunda7.bpmn', 'camunda7', orderScenarios)
    const startForm = harness.injector.get<DataStartForm>('dataStartForm')
    const fieldNames = (scenarioId: string | null) =>
      startForm.fieldsFor(harness.get('startEvent_orderReceived'), scenarioId).map(field => field.name)

    expect(fieldNames(null)).toContain('score')
    expect(fieldNames('small-order')).not.toContain('score')
  })
})

describe('stuck gateways', () => {
  it('stay marked while an instance waits, even when another instance passes the gateway', async () => {
    const harness = await harnessFor('order-zeebe.bpmn', 'zeebe', orderScenarios)
    harness.dataSimulation.selectScenario('missing-total')
    harness.trigger('startEvent_orderReceived')
    harness.dataSimulation.selectScenario('small-order')
    harness.trigger('startEvent_orderReceived')

    expect(harness.markers('gateway_credit')).toEqual(['bds-gateway--stuck'])
    expect(harness.markers('gateway_extras')).toEqual(['bds-gateway--decided'])
  })
})

describe('decision cards on hover and click', () => {
  it('show while a gateway or its flows are hovered and stay when the gateway is clicked', async () => {
    const harness = await harnessFor('order-zeebe.bpmn', 'zeebe', orderScenarios)
    harness.trigger('startEvent_orderReceived')
    const gateway = harness.get('gateway_credit')

    harness.eventBus.fire('element.hover', { element: harness.get('serviceTask_ship') })
    expect(cardsShown(harness)).toEqual([])

    harness.eventBus.fire('element.hover', { element: harness.get('flow_review') })
    expect(cardsShown(harness)).toEqual(['gateway_credit'])

    harness.eventBus.fire('element.click', { element: gateway })
    harness.eventBus.fire('element.hover', { element: harness.get('serviceTask_ship') })
    expect(cardsShown(harness)).toEqual(['gateway_credit'])

    harness.eventBus.fire('element.click', { element: gateway })
    expect(cardsShown(harness)).toEqual([])
  })
})

describe('flow badges', () => {
  it('show the decisions of the selected instance only', async () => {
    const harness = await harnessFor('order-zeebe.bpmn', 'zeebe', orderScenarios)
    harness.trigger('startEvent_orderReceived')
    harness.dataSimulation.selectScenario('bad-credit')
    harness.trigger('startEvent_orderReceived')
    const [first] = harness.dataSimulation.getSnapshot().instances
    harness.overlays.add.mockClear()
    harness.dataSimulation.selectInstance(first.id)

    const badgedFlows = harness.overlays.add.mock.calls
      .filter(([, type]) => type === 'bds-flow-outcome')
      .map(([element]) => (element as { id: string }).id)
    expect(badgedFlows).toContain('flow_insurance')
  })
})

describe('with the data simulation switched off', () => {
  it('behaves like the plain token simulation', async () => {
    const harness = await harnessFor('order-zeebe.bpmn', 'zeebe', orderScenarios)
    const toggled = vi.fn()
    harness.eventBus.on('dataSimulation.toggle', toggled)
    harness.dataSimulation.setEnabled(false)
    harness.simulator.setConfig(harness.get('gateway_credit'), { activeOutgoing: harness.get('flow_rejected') })
    harness.trigger('startEvent_orderReceived')

    expect(toggled.mock.calls[0][0]).toMatchObject({ enabled: false })
    expect(lastEntered(harness)).toBe('endEvent_rejected')
    expect(harness.dataSimulation.getSnapshot()).toMatchObject({ instances: [], log: [] })
  })
})

describe('gateways the engine cannot evaluate', () => {
  it('fall back to the flow chosen by click', async () => {
    const xml = readFixture('order-camunda7.bpmn').replace(
      '${creditworthy &amp;&amp; orderTotal &lt;= 5000}',
      '${execution.getVariable("creditworthy")}',
    )
    const harness = await createHarness(xml, 'camunda7', orderScenarios)
    harness.simulator.setConfig(harness.get('gateway_credit'), { activeOutgoing: harness.get('flow_review') })
    harness.trigger('startEvent_orderReceived')

    expect(harness.entered).toContain('userTask_review')
    expect(harness.dataSimulation.getSnapshot().log[0]).toMatchObject({
      elementId: 'gateway_credit',
      chosenBy: 'click',
      decision: { takenFlowIds: ['flow_review'] },
    })
  })
})

describe('path simulation inside the data simulation', () => {
  it('comes with DataSimulationModule and is the only home of the path', async () => {
    const harness = await harnessFor('order-zeebe.bpmn', 'zeebe', orderScenarios)

    expect(harness.injector.get<PathSimulation>('pathSimulation').simulate).toBeTypeOf('function')
    expect(harness.dataSimulation).not.toHaveProperty('resolve')
    expect(harness.dataSimulation).not.toHaveProperty('clearResolution')
  })

  it('starts no instance', async () => {
    const harness = await harnessFor('order-zeebe.bpmn', 'zeebe', orderScenarios)

    harness.injector.get<PathSimulation>('pathSimulation').simulate({ creditworthy: true, orderTotal: 1200 })

    expect(harness.dataSimulation.getSnapshot()).toMatchObject({ instances: [], log: [] })
    expect(harness.entered).toEqual([])
  })

  it('loads once and shares the engine when both modules are registered', () => {
    const injector = injectorWith([SimulatorModule, PathSimulationModule, DataSimulationModule])

    expect(injector.get<PathSimulation>('pathSimulation').getEngine()).toBe(
      injector.get<DataSimulation>('dataSimulation').getEngine(),
    )
  })

  it('names PathSimulationModule when the token simulation is missing', () => {
    const injector = injectorWith([DataSimulationModule])

    expect(() => injector.get('dataSimulation')).toThrow(
      'DataSimulationModule needs bpmn-js-token-simulation; for the path alone use PathSimulationModule',
    )
  })
})

function injectorWith(modules: object[]): Injector {
  const elementRegistry = { get: () => undefined, filter: () => [] }
  const canvas = { addMarker: vi.fn(), removeMarker: vi.fn() }
  return new Injector([
    {
      eventBus: ['type', EventBus],
      elementRegistry: ['value', elementRegistry],
      canvas: ['value', canvas],
      'config.dataSimulation': ['value', {}],
    },
    ...modules,
  ] as any)
}

function isMarkedStuck(harness: Harness, gatewayId: string): boolean {
  const waitingAt = harness.dataSimulation
    .getSnapshot()
    .instances.flatMap(instance => instance.waiting.map(waiting => waiting.gatewayId))
  return waitingAt.includes(gatewayId) && harness.markers(gatewayId).includes('bds-gateway--stuck')
}

function cardsShown(harness: Harness): string[] {
  return [...harness.container.querySelectorAll('.bds-host')].flatMap(host =>
    [...host.shadowRoot!.querySelectorAll<HTMLElement>('.bds-popover')].map(card => card.dataset.elementId!),
  )
}

function lastEntered(harness: Harness): string | undefined {
  return harness.entered[harness.entered.length - 1]
}
