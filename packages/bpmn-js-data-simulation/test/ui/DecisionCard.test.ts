// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import type { DecisionLogEntry } from '../../src/simulation/DataSimulationStore'
import { DecisionCard } from '../../src/ui/DecisionCard'

function entry(overrides: Partial<DecisionLogEntry> = {}): DecisionLogEntry {
  return {
    id: 1,
    kind: 'decision',
    instanceId: 'i1',
    elementId: 'Gateway',
    elementName: 'Credit OK?',
    gatewayKind: 'exclusive',
    chosenBy: 'data',
    decision: {
      flows: [
        { flow: { id: 'yes', name: 'yes', expression: '=ok and total < 10', isDefault: false }, outcome: 'taken' },
        { flow: { id: 'no', name: 'no', isDefault: true }, outcome: 'not-taken' },
      ],
      takenFlowIds: ['yes'],
    },
    inputs: [
      { name: 'ok', value: true },
      { name: 'total', value: undefined },
    ],
    ...overrides,
  }
}

describe('DecisionCard', () => {
  it('explains the decision with its conditions and the values they read', () => {
    const card = new DecisionCard(entry()).element

    expect(card.querySelector('.bds-decision-title')?.textContent).toBe('Credit OK?exclusive')
    expect(card.querySelector('.bds-flow--taken code')?.textContent).toBe('=ok and total < 10')
    expect(card.querySelector('.bds-flow--not-taken .bds-tag')?.textContent).toBe('default')
    expect([...card.querySelectorAll('.bds-decision-inputs > *')].map(node => node.textContent)).toEqual([
      'ok',
      'true',
      'total',
      'not set',
    ])
    expect(card.querySelector('.bds-decision-close')).toBeNull()
  })

  it('tells how to continue a stuck gateway', () => {
    const card = new DecisionCard(
      entry({ decision: { flows: [], takenFlowIds: [], stuckReason: 'No condition is true' } }),
    ).element

    expect(card.classList).toContain('bds-decision--stuck')
    expect(card.querySelector('.bds-error')?.textContent).toBe(
      'No condition is true. Change the variables in Process Data, then press ▶ on the gateway.',
    )
  })

  it('closes a pinned card', () => {
    const onClose = vi.fn()
    new DecisionCard(entry(), onClose).element.querySelector<HTMLButtonElement>('.bds-decision-close')!.click()

    expect(onClose).toHaveBeenCalled()
  })
})
