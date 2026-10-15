import { describe, expect, it } from 'vitest'
import type { Evaluation, OutgoingFlow } from '../../src/domain/model'
import { routeGateway } from '../../src/domain/routing'

const flows: OutgoingFlow[] = [
  { id: 'small', expression: 'small', isDefault: false },
  { id: 'large', expression: 'large', isDefault: false },
  { id: 'fallback', isDefault: true },
]

function conditions(values: Record<string, Evaluation>) {
  return (expression: string): Evaluation => values[expression]
}

const yes: Evaluation = { ok: true, value: true }
const no: Evaluation = { ok: true, value: false }

describe('routeGateway (exclusive)', () => {
  it('takes the first flow whose condition is true and skips the rest', () => {
    const decision = routeGateway('exclusive', flows, conditions({ small: yes, large: yes }))

    expect(decision.takenFlowIds).toEqual(['small'])
    expect(decision.flows.map(flow => flow.outcome)).toEqual(['taken', 'skipped', 'not-taken'])
  })

  it('takes the default flow when no condition is true', () => {
    const decision = routeGateway('exclusive', flows, conditions({ small: no, large: no }))

    expect(decision.takenFlowIds).toEqual(['fallback'])
    expect(decision.flows.map(flow => flow.outcome)).toEqual(['not-taken', 'not-taken', 'taken'])
  })

  it('gets stuck when no condition is true and there is no default flow', () => {
    const decision = routeGateway('exclusive', flows.slice(0, 2), conditions({ small: no, large: no }))

    expect(decision.takenFlowIds).toEqual([])
    expect(decision.stuckReason).toBe('No condition is true and there is no default flow')
  })

  it('gets stuck on an evaluation error before a true condition, like an engine incident', () => {
    const decision = routeGateway(
      'exclusive',
      flows,
      conditions({ small: { ok: false, reason: "Variable 'total' not found" }, large: yes }),
    )

    expect(decision.takenFlowIds).toEqual([])
    expect(decision.stuckReason).toBe(`Condition of "small" failed: Variable 'total' not found`)
    expect(decision.flows.map(flow => flow.outcome)).toEqual(['error', 'skipped', 'skipped'])
  })

  it('treats a non-boolean result as an error', () => {
    const decision = routeGateway('exclusive', flows, conditions({ small: { ok: true, value: 'yes' }, large: no }))

    expect(decision.flows[0]).toMatchObject({ outcome: 'error', reason: 'Expected a boolean but got string "yes"' })
    expect(decision.stuckReason).toContain('Expected a boolean')
  })

  it('treats a flow without a condition as an error', () => {
    const decision = routeGateway('exclusive', [{ id: 'bare', isDefault: false }], conditions({}))

    expect(decision.flows[0]).toMatchObject({ outcome: 'error', reason: 'Missing condition' })
  })
})

describe('routeGateway (inclusive)', () => {
  it('takes every flow whose condition is true but not the default flow', () => {
    const decision = routeGateway('inclusive', flows, conditions({ small: yes, large: yes }))

    expect(decision.takenFlowIds).toEqual(['small', 'large'])
    expect(decision.flows.map(flow => flow.outcome)).toEqual(['taken', 'taken', 'not-taken'])
  })

  it('takes only the default flow when no condition is true', () => {
    const decision = routeGateway('inclusive', flows, conditions({ small: no, large: no }))

    expect(decision.takenFlowIds).toEqual(['fallback'])
  })

  it('gets stuck when any condition fails', () => {
    const decision = routeGateway('inclusive', flows, conditions({ small: yes, large: { ok: false, reason: 'boom' } }))

    expect(decision.takenFlowIds).toEqual([])
    expect(decision.stuckReason).toBe('Condition of "large" failed: boom')
  })
})
