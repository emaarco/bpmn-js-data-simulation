import { describe, expect, it } from 'vitest'
import type { DecisionLogEntry, InstanceState, SimulationSnapshot } from '../../src/simulation/DataSimulationStore'
import { GatewayDecisionView } from '../../src/simulation/GatewayDecisionView'

function decision(id: number, instanceId: string, elementId: string): DecisionLogEntry {
  return {
    id,
    kind: 'decision',
    instanceId,
    elementId,
    elementName: elementId,
    gatewayKind: 'exclusive',
    chosenBy: 'data',
    decision: { flows: [], takenFlowIds: [] },
    inputs: [],
  }
}

function instance(id: string, waitingAt: string[] = []): InstanceState {
  return {
    id,
    number: 1,
    processName: 'Order',
    scenarioId: null,
    status: waitingAt.length ? 'waiting' : 'running',
    variables: {},
    waiting: waitingAt.map(gatewayId => ({ scopeId: `${id}-${gatewayId}`, gatewayId, gatewayName: gatewayId })),
  }
}

function snapshot(overrides: Partial<SimulationSnapshot>): SimulationSnapshot {
  return {
    engineLabel: 'Zeebe',
    expressionLanguage: 'FEEL',
    scenarios: [],
    selectedScenarioId: null,
    startVariables: {},
    instances: [],
    selectedInstanceId: null,
    log: [],
    ...overrides,
  }
}

describe('GatewayDecisionView', () => {
  it('keeps the latest decision per gateway of the selected instance', () => {
    const view = new GatewayDecisionView(
      snapshot({
        instances: [instance('a'), instance('b')],
        selectedInstanceId: 'a',
        log: [decision(1, 'a', 'Gateway'), decision(2, 'b', 'Gateway'), decision(3, 'a', 'Gateway')],
      }),
    )

    expect(view.decisions.map(entry => entry.id)).toEqual([3])
    expect(view.shown.map(entry => entry.id)).toEqual([3])
  })

  it('also shows gateways where another instance is stuck', () => {
    const view = new GatewayDecisionView(
      snapshot({
        instances: [instance('a'), instance('b', ['Stuck'])],
        selectedInstanceId: 'a',
        log: [decision(1, 'a', 'Gateway'), decision(2, 'b', 'Stuck')],
      }),
    )

    expect(view.decisions.map(entry => entry.id)).toEqual([1])
    expect(view.shown.map(entry => entry.id)).toEqual([1, 2])
  })

  it('prefers the newest stuck decision over the selected instance decision at the same gateway', () => {
    const view = new GatewayDecisionView(
      snapshot({
        instances: [instance('a'), instance('b', ['Gateway'])],
        selectedInstanceId: 'a',
        log: [decision(1, 'a', 'Gateway'), decision(2, 'b', 'Gateway')],
      }),
    )

    expect(view.shown.map(entry => entry.id)).toEqual([2])
  })
})
