// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import type { DataSimulationStore } from '../../src/simulation/DataSimulationStore'
import { type Harness, harnessFor } from './harness'

const fixtures = [
  ['zeebe', 'fleet-zeebe.bpmn'],
  ['camunda7', 'fleet-camunda7.bpmn'],
] as const

const fleetScenarios = {
  scenarios: [
    {
      id: 'four-bikes-two-sites',
      variables: { bikes: ['city', 'city', 'cargo', 'trekking'], sites: ['Munich', 'Augsburg'] },
      taskResults: { serviceTask_assembleBike: { assembled: true } },
    },
    { id: 'already-assembled', variables: { bikes: [], sites: ['Berlin'] } },
    { id: 'sites-missing', variables: { bikes: ['city'] } },
  ],
}

describe.each(fixtures)('multi-instance activities with %s', (engine, fixture) => {
  it('runs one instance per item of the collection', async () => {
    const harness = await harnessFor(fixture, engine, fleetScenarios)
    harness.trigger('startEvent_fleetOrderReceived')

    expect(countEntered(harness, 'serviceTask_assembleBike')).toBe(1 + 4)
    expect(countEntered(harness, 'subProcess_deliverToSite')).toBe(1 + 2)
    expect(countEntered(harness, 'userTask_loadVan')).toBe(2)
    expect(harness.dataSimulation.getSnapshot().instances[0].status).toBe('completed')
  })

  it('moves on only after the last instance is done', async () => {
    const harness = await harnessFor(fixture, engine, fleetScenarios)
    harness.trigger('startEvent_fleetOrderReceived')

    const lastInstance = harness.entered.lastIndexOf('serviceTask_assembleBike')
    expect(harness.entered.indexOf('subProcess_deliverToSite')).toBeGreaterThan(lastInstance)
    expect(harness.entered.indexOf('serviceTask_sendInvoice')).toBeGreaterThan(
      harness.entered.lastIndexOf('userTask_handOverBikes'),
    )
  })

  it('runs a sequential sub-process instance by instance, each with its own inner flow', async () => {
    const harness = await harnessFor(fixture, engine, fleetScenarios)
    harness.trigger('startEvent_fleetOrderReceived')

    const deliveries = harness.entered.filter(id =>
      ['subProcess_deliverToSite', 'userTask_loadVan', 'userTask_handOverBikes'].includes(id),
    )
    expect(deliveries).toEqual([
      'subProcess_deliverToSite',
      'subProcess_deliverToSite',
      'userTask_loadVan',
      'userTask_handOverBikes',
      'subProcess_deliverToSite',
      'userTask_loadVan',
      'userTask_handOverBikes',
    ])
  })

  it('skips the activity for an empty collection', async () => {
    const harness = await harnessFor(fixture, engine, fleetScenarios)
    harness.dataSimulation.selectScenario('already-assembled')
    harness.trigger('startEvent_fleetOrderReceived')

    expect(countEntered(harness, 'serviceTask_assembleBike')).toBe(1)
    expect(countEntered(harness, 'userTask_loadVan')).toBe(1)
    expect(harness.dataSimulation.getSnapshot().instances[0].status).toBe('completed')
  })

  it('falls back to 3 instances when the collection cannot be read', async () => {
    const harness = await harnessFor(fixture, engine, fleetScenarios)
    harness.dataSimulation.selectScenario('sites-missing')
    harness.trigger('startEvent_fleetOrderReceived')

    expect(countEntered(harness, 'subProcess_deliverToSite')).toBe(1 + 3)
  })

  it('runs 3 instances without process data', async () => {
    const harness = await harnessFor(fixture, engine, fleetScenarios)
    harness.dataSimulation.setEnabled(false)
    harness.trigger('startEvent_fleetOrderReceived')

    expect(countEntered(harness, 'serviceTask_assembleBike')).toBe(1 + 3)
    expect(countEntered(harness, 'userTask_loadVan')).toBe(3)
  })

  it('applies the mappings and task result of the activity once, when the last instance is done', async () => {
    const harness = await harnessFor(fixture, engine, fleetScenarios)
    const store = harness.injector.get<DataSimulationStore>('dataSimulationStore')
    const setVariables = vi.spyOn(store, 'setVariables')
    harness.trigger('startEvent_fleetOrderReceived')

    expect(setVariables).toHaveBeenCalledTimes(1)
    expect(harness.dataSimulation.getSnapshot().instances[0].variables).toMatchObject({ assembled: true })
  })
})

describe('multi-instance loop cardinality', () => {
  it('runs as many instances as the cardinality says', async () => {
    const harness = await harnessFor('fleet-camunda7.bpmn', 'camunda7', fleetScenarios)
    harness.trigger('startEvent_fleetOrderReceived')

    expect(countEntered(harness, 'serviceTask_testRide')).toBe(1 + 2)
    expect(harness.entered[harness.entered.length - 1]).toBe('endEvent_fleetDelivered')
  })
})

function countEntered(harness: Harness, elementId: string): number {
  return harness.entered.filter(id => id === elementId).length
}
