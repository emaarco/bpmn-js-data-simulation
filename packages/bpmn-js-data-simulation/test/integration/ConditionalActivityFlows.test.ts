// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import type { DecisionLogEntry } from '../../src/simulation/DataSimulationStore'
import { readFixture } from '../engines/moddle'
import { createHarness, createPathSimulationHarness, type Harness } from './harness'

const FIXTURE = 'repair-camunda7-conditional-flows.bpmn'
const ORDER_TASKS = ['serviceTask_orderBrakePads', 'serviceTask_orderTires']

const repairScenarios = {
  scenarios: [
    { id: 'both-worn', variables: {}, taskResults: { userTask_inspectBike: { brakesWorn: true, tiresWorn: true } } },
    {
      id: 'nothing-worn',
      variables: {},
      taskResults: { userTask_inspectBike: { brakesWorn: false, tiresWorn: false } },
    },
    { id: 'tires-unknown', variables: {}, taskResults: { userTask_inspectBike: { brakesWorn: true } } },
  ],
}

function camunda7Harness(xml = readFixture(FIXTURE)): Promise<Harness> {
  return createHarness(xml, 'camunda7', repairScenarios)
}

function asZeebe(xml: string): string {
  return xml.replace('${brakesWorn}', '=brakesWorn').replace('${tiresWorn}', '=tiresWorn')
}

function start(harness: Harness, scenarioId: string): void {
  harness.dataSimulation.selectScenario(scenarioId)
  harness.trigger('startEvent_bikeHandedIn')
}

function activityDecision(harness: Harness): DecisionLogEntry {
  return harness.dataSimulation
    .getSnapshot()
    .log.find((entry): entry is DecisionLogEntry => entry.elementId === 'userTask_inspectBike')!
}

describe('conditional flows that leave an activity, with Camunda 7', () => {
  it('take every flow whose condition is true, one token each', async () => {
    const harness = await camunda7Harness()
    start(harness, 'both-worn')

    expect(harness.entered).toEqual(expect.arrayContaining(ORDER_TASKS))
    expect(harness.entered).not.toContain('flow_nothingWorn')
    expect(harness.entered[harness.entered.length - 1]).toBe('endEvent_bikeRepaired')
    expect(activityDecision(harness)).toMatchObject({
      gatewayKind: 'activity',
      chosenBy: 'data',
      decision: { takenFlowIds: ['flow_brakesWorn', 'flow_tiresWorn'] },
      inputs: [
        { name: 'brakesWorn', value: true },
        { name: 'tiresWorn', value: true },
      ],
    })
    expect(harness.markers('userTask_inspectBike')).toEqual(['bds-gateway--decided'])
  })

  it('take the default flow when no condition is true', async () => {
    const harness = await camunda7Harness()
    start(harness, 'nothing-worn')

    expect(harness.entered).toContain('flow_nothingWorn')
    expect(harness.entered).not.toContain('serviceTask_orderBrakePads')
    expect(harness.entered).not.toContain('serviceTask_orderTires')
    expect(harness.dataSimulation.getSnapshot().instances[0].status).toBe('completed')
  })

  it('keep the token at the activity when a condition fails and continue after the data is fixed', async () => {
    const harness = await camunda7Harness()
    start(harness, 'tires-unknown')

    const [instance] = harness.dataSimulation.getSnapshot().instances
    expect(instance).toMatchObject({ status: 'waiting', waiting: [{ gatewayId: 'userTask_inspectBike' }] })
    expect(harness.markers('userTask_inspectBike')).toEqual(['bds-gateway--stuck'])
    expect(harness.entered).not.toContain('serviceTask_orderBrakePads')

    harness.dataSimulation.setInstanceVariables(instance.id, { brakesWorn: false, tiresWorn: false })
    harness.trigger('userTask_inspectBike')

    expect(harness.entered).toContain('flow_nothingWorn')
    expect(harness.entered).not.toContain('serviceTask_orderBrakePads')
    expect(harness.dataSimulation.getSnapshot().instances[0]).toMatchObject({
      status: 'completed',
      variables: { brakesWorn: false, tiresWorn: false },
    })
  })

  it('show the decision card when a flow leaving the activity is hovered', async () => {
    const harness = await camunda7Harness()
    start(harness, 'both-worn')

    harness.eventBus.fire('element.hover', { element: harness.get('flow_tiresWorn') })

    expect(cardsShown(harness)).toEqual(['userTask_inspectBike'])
  })

  it('leave through every flow when the data simulation is switched off', async () => {
    const harness = await camunda7Harness()
    harness.dataSimulation.setEnabled(false)
    harness.trigger('startEvent_bikeHandedIn')

    expect(harness.entered).toEqual(expect.arrayContaining([...ORDER_TASKS, 'flow_nothingWorn']))
  })

  it('leave through every flow when a condition is a script the engine cannot evaluate', async () => {
    const xml = readFixture(FIXTURE).replace(
      '<bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">${tiresWorn}',
      '<bpmn:conditionExpression xsi:type="bpmn:tFormalExpression" language="javascript">tiresWorn',
    )
    const harness = await camunda7Harness(xml)
    start(harness, 'nothing-worn')

    expect(harness.entered).toEqual(expect.arrayContaining([...ORDER_TASKS, 'flow_nothingWorn']))
    expect(activityDecision(harness)).toBeUndefined()
  })
})

describe('conditional flows that leave an activity, with Zeebe', () => {
  it('stop the token, because Zeebe rejects such a model on deploy', async () => {
    const harness = await createHarness(asZeebe(readFixture(FIXTURE)), 'zeebe', repairScenarios)
    start(harness, 'both-worn')

    expect(harness.entered).not.toContain('serviceTask_orderBrakePads')
    expect(harness.dataSimulation.getSnapshot().instances[0].status).toBe('waiting')
    expect(activityDecision(harness).decision).toMatchObject({
      takenFlowIds: [],
      refusedByEngine: true,
      stuckReason: expect.stringContaining('only supported at exclusive or inclusive gateways'),
    })
  })
})

describe('path simulation of conditional flows that leave an activity', () => {
  it('follows the flows whose condition is true with Camunda 7', async () => {
    const { pathSimulation, markers } = await createPathSimulationHarness(readFixture(FIXTURE), 'camunda7')

    const path = pathSimulation.simulate({ brakesWorn: true, tiresWorn: false })

    expect(path.decisions.userTask_inspectBike.takenFlowIds).toEqual(['flow_brakesWorn'])
    expect(path.taken).toContain('serviceTask_orderBrakePads')
    expect(path.skipped).toEqual(expect.arrayContaining(['serviceTask_orderTires', 'flow_nothingWorn']))
    expect(markers('serviceTask_orderTires')).toEqual(['bds-path--skipped'])
  })

  it('stops at the activity with Zeebe', async () => {
    const { pathSimulation, markers } = await createPathSimulationHarness(asZeebe(readFixture(FIXTURE)), 'zeebe')

    const path = pathSimulation.simulate({ brakesWorn: true, tiresWorn: false })

    expect(path.decisions.userTask_inspectBike.refusedByEngine).toBe(true)
    expect(path.skipped).toEqual(expect.arrayContaining(ORDER_TASKS))
    expect(markers('userTask_inspectBike')).toContain('bds-path--stuck')
  })
})

function cardsShown(harness: Harness): string[] {
  return [...harness.container.querySelectorAll('.bds-host')].flatMap(host =>
    [...host.shadowRoot!.querySelectorAll<HTMLElement>('.bds-popover')].map(card => card.dataset.elementId!),
  )
}
