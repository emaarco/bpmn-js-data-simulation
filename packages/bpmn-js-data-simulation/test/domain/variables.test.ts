import { describe, expect, it } from 'vitest'
import { setVariable } from '../../src/domain/variables'

describe('setVariable', () => {
  it('sets a top-level variable without mutating the input', () => {
    const variables = { a: 1 }

    expect(setVariable(variables, 'b', 2)).toEqual({ a: 1, b: 2 })
    expect(variables).toEqual({ a: 1 })
  })

  it('creates and merges nested objects for dotted paths', () => {
    expect(setVariable({ customer: { name: 'Ada' } }, 'customer.tier', 'gold')).toEqual({
      customer: { name: 'Ada', tier: 'gold' },
    })
    expect(setVariable({ customer: 'plain' }, 'customer.tier', 'gold')).toEqual({ customer: { tier: 'gold' } })
  })
})
