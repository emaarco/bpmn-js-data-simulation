import { describe, expect, it, vi } from 'vitest'
import type { Scenario } from '../../src/domain/scenario'
import { DataSimulationStore } from '../../src/simulation/DataSimulationStore'

const scenarios: Scenario[] = [
  { id: 'a', name: 'A', variables: { total: 1 }, taskResults: { Task: { score: 1 } } },
  { id: 'b', name: 'B', variables: { total: 2 }, taskResults: { Task: { score: 2 } } },
]

describe('DataSimulationStore', () => {
  it('selects the first scenario and uses its variables as start variables', () => {
    const store = new DataSimulationStore()
    store.setScenarios(scenarios)

    expect(store.getSnapshot()).toMatchObject({ selectedScenarioId: 'a', startVariables: { total: 1 } })
  })

  it('seeds a new instance with a copy of the start variables and selects it', () => {
    const store = new DataSimulationStore()
    store.setScenarios(scenarios)
    store.setStartVariables({ total: 99, nested: { x: 1 } })
    store.startInstance('first', 'Order')
    store.startInstance('second', 'Order')
    store.setVariables('second', { total: 100 })

    expect(store.getVariables('first')).toEqual({ total: 99, nested: { x: 1 } })
    expect(store.getSnapshot()).toMatchObject({
      selectedInstanceId: 'second',
      startVariables: { total: 99, nested: { x: 1 } },
    })
    expect(store.getSnapshot().instances.map(instance => instance.number)).toEqual([1, 2])
  })

  it('takes task results from the scenario an instance was started with', () => {
    const store = new DataSimulationStore()
    store.setScenarios(scenarios)
    store.startInstance('instance', 'Order')
    store.selectScenario('b')

    expect(store.getTaskResult('instance', 'Task')).toEqual({ score: 1 })
  })

  it('has no task results for an instance started without a scenario', () => {
    const store = new DataSimulationStore()
    store.setScenarios(scenarios)
    store.selectScenario(null)
    store.startInstance('instance', 'Order')

    expect(store.getSnapshot().startVariables).toEqual({})
    expect(store.getTaskResult('instance', 'Task')).toBeUndefined()
  })

  it('reports an instance waiting at a gateway until it continues', () => {
    const store = new DataSimulationStore()
    store.startInstance('instance', 'Order')
    store.addWaiting('instance', { scopeId: 'wait', gatewayId: 'Gateway', gatewayName: 'Credit OK?' })

    expect(store.getSnapshot().instances[0]).toMatchObject({ status: 'waiting' })
    store.removeWaiting('wait')
    expect(store.getSnapshot().instances[0]).toMatchObject({ status: 'running', waiting: [] })
  })

  it('marks instances completed and ignores unknown instances', () => {
    const store = new DataSimulationStore()
    store.startInstance('instance', 'Order')
    store.completeInstance('instance')
    store.completeInstance('token-scope')

    expect(store.getSnapshot().instances).toEqual([
      {
        id: 'instance',
        number: 1,
        processName: 'Order',
        scenarioId: null,
        status: 'completed',
        variables: {},
        waiting: [],
      },
    ])
  })

  it('clears instances and the log on reset but keeps the scenario selection', () => {
    const store = new DataSimulationStore()
    store.setScenarios(scenarios)
    store.selectScenario('b')
    store.startInstance('instance', 'Order')
    store.record({
      kind: 'mapping-issue',
      instanceId: 'instance',
      elementId: 'T',
      elementName: 'T',
      target: 'x',
      reason: 'r',
    })
    store.reset()

    expect(store.getSnapshot()).toMatchObject({
      instances: [],
      log: [],
      selectedInstanceId: null,
      selectedScenarioId: 'b',
    })
  })

  it('notifies subscribers until they unsubscribe', () => {
    const store = new DataSimulationStore()
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)
    store.setStartVariables({ a: 1 })
    unsubscribe()
    store.setStartVariables({ a: 2 })

    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener.mock.calls[0][0].startVariables).toEqual({ a: 1 })
  })
})
