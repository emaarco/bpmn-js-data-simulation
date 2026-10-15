// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
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
    harness.trigger('Start')

    expect(harness.entered).toEqual(
      expect.arrayContaining(['Task_CheckCredit', 'Gateway_Credit', 'Task_Ship', 'Task_Insurance', 'Task_Accessories']),
    )
    expect(harness.entered).not.toContain('Task_Review')
    expect(lastEntered(harness)).toBe('End_Shipped')

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
        elementId: 'Gateway_Credit',
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
    harness.trigger('Start')

    expect(harness.entered).toEqual(expect.arrayContaining(['Task_Review', 'Gateway_Approved', 'Task_Ship']))
    expect(harness.entered).not.toContain('Task_Insurance')
    expect(harness.entered).toContain('End_Shipped')
    expect(harness.dataSimulation.getSnapshot().instances[0].variables).toMatchObject({ approved: true })
  })

  it('takes the default flow when no condition is true', async () => {
    const harness = await harnessFor(fixture, engine, orderScenarios)
    harness.dataSimulation.selectScenario('bad-credit')
    harness.trigger('Start')

    expect(lastEntered(harness)).toBe('End_Rejected')
    const decision = harness.dataSimulation.getSnapshot().log[0] as DecisionLogEntry
    expect(decision).toMatchObject({ kind: 'decision', elementId: 'Gateway_Credit', elementName: 'Credit OK?' })
    expect(decision.decision.flows.map(flow => [flow.flow.id, flow.outcome])).toEqual([
      ['Flow_Approved', 'not-taken'],
      ['Flow_Review', 'not-taken'],
      ['Flow_Rejected', 'taken'],
    ])
  })

  it('keeps the token at a gateway whose condition fails and continues after the data is fixed', async () => {
    const harness = await harnessFor(fixture, engine, orderScenarios)
    harness.dataSimulation.selectScenario('missing-total')
    harness.trigger('Start')

    expect(harness.entered).not.toContain('End_Shipped')
    expect(isMarkedStuck(harness, 'Gateway_Credit')).toBe(true)
    const [instance] = harness.dataSimulation.getSnapshot().instances
    expect(instance).toMatchObject({ status: 'waiting', waiting: [{ gatewayId: 'Gateway_Credit' }] })

    harness.dataSimulation.setInstanceVariables(instance.id, { ...instance.variables, orderTotal: 99 })
    harness.trigger('Gateway_Credit')

    expect(lastEntered(harness)).toBe('End_Shipped')
    expect(harness.dataSimulation.getSnapshot().instances[0].status).toBe('completed')
    expect(isMarkedStuck(harness, 'Gateway_Credit')).toBe(false)
  })

  it('logs output mappings that cannot be evaluated', async () => {
    const harness = await harnessFor(fixture, engine, orderScenarios)
    harness.dataSimulation.selectScenario('no-credit-result')
    harness.trigger('Start')

    const issues = harness.dataSimulation
      .getSnapshot()
      .log.filter((entry): entry is MappingIssueLogEntry => entry.kind === 'mapping-issue')
    expect(issues.map(issue => issue.target)).toEqual(['creditScore', 'creditworthy'])
    expect(harness.entered).not.toContain('End_Shipped')
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
    harness.trigger('Start')

    expect(harness.entered).toContain('Task_Ship')
    expect(lastEntered(harness)).toBe('End_Shipped')
  })

  it('takes task results from the scenario the instance was started with', async () => {
    const harness = await harnessFor(fixture, engine, orderScenarios)
    harness.simulator.waitAtElement(harness.get('Task_CheckCredit'))
    harness.trigger('Start')
    harness.dataSimulation.selectScenario('bad-credit')
    harness.trigger('Task_CheckCredit')

    expect(harness.dataSimulation.getSnapshot().instances[0].variables).toMatchObject({ creditScore: 720 })
    expect(lastEntered(harness)).toBe('End_Shipped')
  })

  it('clears instances and the log on reset', async () => {
    const harness = await harnessFor(fixture, engine, orderScenarios)
    harness.trigger('Start')
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
        taskResults: { Task_CheckCredit: { score: 720, ratingAgency: 'Schufa' } },
      },
    ],
  }

  it('Zeebe only keeps what the output mappings write', async () => {
    const harness = await harnessFor('order-zeebe.bpmn', 'zeebe', scenarios)
    harness.trigger('Start')

    expect(harness.dataSimulation.getSnapshot().instances[0].variables).not.toHaveProperty('ratingAgency')
  })

  it('Camunda 7 also propagates the completion variables', async () => {
    const harness = await harnessFor('order-camunda7.bpmn', 'camunda7', scenarios)
    harness.trigger('Start')

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
      startForm.fieldsFor(harness.get('Start'), scenarioId).map(field => field.name)

    expect(fieldNames(null)).toContain('score')
    expect(fieldNames('small-order')).not.toContain('score')
  })
})

describe('stuck gateways', () => {
  it('stay marked while an instance waits, even when another instance passes the gateway', async () => {
    const harness = await harnessFor('order-zeebe.bpmn', 'zeebe', orderScenarios)
    harness.dataSimulation.selectScenario('missing-total')
    harness.trigger('Start')
    harness.dataSimulation.selectScenario('small-order')
    harness.trigger('Start')

    expect(harness.markers('Gateway_Credit')).toEqual(['bds-gateway--stuck'])
    expect(harness.markers('Gateway_Extras')).toEqual(['bds-gateway--decided'])
  })
})

describe('decision cards on hover and click', () => {
  it('show while a gateway or its flows are hovered and stay when the gateway is clicked', async () => {
    const harness = await harnessFor('order-zeebe.bpmn', 'zeebe', orderScenarios)
    harness.trigger('Start')
    const gateway = harness.get('Gateway_Credit')

    harness.eventBus.fire('element.hover', { element: harness.get('Task_Ship') })
    expect(cardsShown(harness)).toEqual([])

    harness.eventBus.fire('element.hover', { element: harness.get('Flow_Review') })
    expect(cardsShown(harness)).toEqual(['Gateway_Credit'])

    harness.eventBus.fire('element.click', { element: gateway })
    harness.eventBus.fire('element.hover', { element: harness.get('Task_Ship') })
    expect(cardsShown(harness)).toEqual(['Gateway_Credit'])

    harness.eventBus.fire('element.click', { element: gateway })
    expect(cardsShown(harness)).toEqual([])
  })
})

describe('flow badges', () => {
  it('show the decisions of the selected instance only', async () => {
    const harness = await harnessFor('order-zeebe.bpmn', 'zeebe', orderScenarios)
    harness.trigger('Start')
    harness.dataSimulation.selectScenario('bad-credit')
    harness.trigger('Start')
    const [first] = harness.dataSimulation.getSnapshot().instances
    harness.overlays.add.mockClear()
    harness.dataSimulation.selectInstance(first.id)

    const badgedFlows = harness.overlays.add.mock.calls
      .filter(([, type]) => type === 'bds-flow-outcome')
      .map(([element]) => (element as { id: string }).id)
    expect(badgedFlows).toContain('Flow_Insurance')
  })
})

describe('with the data simulation switched off', () => {
  it('behaves like the plain token simulation', async () => {
    const harness = await harnessFor('order-zeebe.bpmn', 'zeebe', orderScenarios)
    const toggled = vi.fn()
    harness.eventBus.on('dataSimulation.toggle', toggled)
    harness.dataSimulation.setEnabled(false)
    harness.simulator.setConfig(harness.get('Gateway_Credit'), { activeOutgoing: harness.get('Flow_Rejected') })
    harness.trigger('Start')

    expect(toggled.mock.calls[0][0]).toMatchObject({ enabled: false })
    expect(lastEntered(harness)).toBe('End_Rejected')
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
    harness.simulator.setConfig(harness.get('Gateway_Credit'), { activeOutgoing: harness.get('Flow_Review') })
    harness.trigger('Start')

    expect(harness.entered).toContain('Task_Review')
    expect(harness.dataSimulation.getSnapshot().log[0]).toMatchObject({
      elementId: 'Gateway_Credit',
      chosenBy: 'click',
      decision: { takenFlowIds: ['Flow_Review'] },
    })
  })
})

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
