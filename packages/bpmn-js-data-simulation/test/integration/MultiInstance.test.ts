// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import type { DataStartForm } from '../../src/integration/DataStartForm'
import type { DataSimulationStore } from '../../src/simulation/DataSimulationStore'
import { type Harness, harnessFor } from './harness'
import type { DecisionLogEntry } from '../../src/simulation/DataSimulationStore'

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
  it('offers the collections as start variables', async () => {
    const harness = await harnessFor(fixture, engine, fleetScenarios)
    const startForm = harness.injector.get<DataStartForm>('dataStartForm')

    const fields = startForm.fieldsFor(harness.get('startEvent_fleetOrderReceived'), 'four-bikes-two-sites')
    expect(fields).toEqual(
      expect.arrayContaining([
        { name: 'bikes', type: 'json', usedBy: ['Assemble bike'] },
        { name: 'sites', type: 'json', usedBy: ['Deliver to site'] },
      ]),
    )
  })

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

  it('logs how many instances ran and where the count comes from', async () => {
    const harness = await harnessFor(fixture, engine, fleetScenarios)
    harness.dataSimulation.selectScenario('sites-missing')
    harness.trigger('startEvent_fleetOrderReceived')

    const entries = harness.dataSimulation.getSnapshot().log.filter(entry => entry.kind === 'multi-instance')
    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          elementId: 'serviceTask_assembleBike',
          mode: 'parallel',
          count: expect.objectContaining({ count: 1, source: 'collection' }),
        }),
        expect.objectContaining({
          elementId: 'subProcess_deliverToSite',
          mode: 'sequential',
          count: expect.objectContaining({ count: 3, source: 'default', reason: expect.stringContaining('sites') }),
        }),
      ]),
    )
  })

  it('shows the progress of the instances on the activity', async () => {
    const harness = await harnessFor(fixture, engine, fleetScenarios)
    harness.trigger('startEvent_fleetOrderReceived')

    expect(progressOn(harness, 'serviceTask_assembleBike')).toBe('4/4')
    expect(progressOn(harness, 'subProcess_deliverToSite')).toBe('2/2')
  })

  it('hides the token count of the token simulation on multi-instance activities, the tag shows it', async () => {
    const harness = await harnessFor(fixture, engine, fleetScenarios)
    harness.overlays.remove.mockClear()
    harness.eventBus.fire('tokenSimulation.simulator.elementChanged', {
      element: harness.get('serviceTask_assembleBike'),
    })
    harness.eventBus.fire('tokenSimulation.simulator.elementChanged', {
      element: harness.get('serviceTask_sendInvoice'),
    })

    expect(harness.overlays.remove.mock.calls).toEqual([
      [{ element: harness.get('serviceTask_assembleBike'), type: 'bts-token-count' }],
    ])
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

describe('multi-instance activity with conditional outgoing flows', () => {
  it('routes by data once, after the last instance', async () => {
    const harness = await harnessFor('repair-camunda7-multi-instance.bpmn', 'camunda7', {
      scenarios: [
        {
          id: 'both-worn',
          variables: {},
          taskResults: { userTask_inspectBike: { brakesWorn: true, tiresWorn: true } },
        },
      ],
    })
    harness.trigger('startEvent_bikeHandedIn')

    expect(countEntered(harness, 'userTask_inspectBike')).toBe(1 + 2)
    expect(countEntered(harness, 'serviceTask_orderBrakePads')).toBe(1)
    expect(countEntered(harness, 'serviceTask_orderTires')).toBe(1)
    const decisions = harness.dataSimulation
      .getSnapshot()
      .log.filter((entry): entry is DecisionLogEntry => entry.kind === 'decision')
    expect(decisions.map(entry => entry.elementId)).toEqual(['userTask_inspectBike'])
  })
})

function progressOn(harness: Harness, elementId: string): string | null | undefined {
  const calls = harness.overlays.add.mock.calls as unknown as Array<[{ id: string }, string, { html: HTMLElement }]>
  const [, , overlay] = calls
    .filter(([element, type]) => element.id === elementId && type === 'bds-loop-progress')
    .pop()!
  return overlay.html.shadowRoot!.textContent
}

function countEntered(harness: Harness, elementId: string): number {
  return harness.entered.filter(id => id === elementId).length
}
