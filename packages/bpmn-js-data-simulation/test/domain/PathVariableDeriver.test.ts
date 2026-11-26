import { describe, expect, it } from 'vitest'
import type { ConditionReads } from '../../src/domain/model'
import { PathVariableDeriver } from '../../src/domain/PathVariableDeriver'

function condition(expression: string, ...variableNames: string[]): ConditionReads {
  return { expression, variableNames }
}

const deriver = new PathVariableDeriver()

describe('PathVariableDeriver', () => {
  it('derives each variable the conditions read once, typed by its current value', () => {
    const conditions = [
      condition('=creditworthy and orderTotal <= 5000', 'creditworthy', 'orderTotal'),
      condition('=creditworthy and orderTotal > 5000', 'creditworthy', 'orderTotal'),
      condition('=segment = "B2B"', 'segment'),
      condition('=count(accessories) > 0', 'accessories'),
      condition('=customer.vip', 'customer'),
      condition('=approved', 'approved'),
    ]

    const variables = deriver.derive(conditions, {
      creditworthy: true,
      orderTotal: 1200,
      segment: 'B2C',
      accessories: ['lock'],
      customer: { vip: false },
    })

    expect(variables).toEqual([
      { name: 'creditworthy', type: 'boolean' },
      { name: 'orderTotal', type: 'number', range: { min: 0, max: 10000, step: 100 } },
      { name: 'segment', type: 'text' },
      { name: 'accessories', type: 'json' },
      { name: 'customer', type: 'json' },
      { name: 'approved', type: 'text' },
    ])
  })

  it('spans the slider over the value or twice the numbers it is compared with, whichever is larger', () => {
    const rangeOf = (value: number, expression = '=total > 0') => {
      const [variable] = deriver.derive([condition(expression, 'total')], { total: value })
      return variable.type === 'number' ? variable.range : undefined
    }

    expect(rangeOf(1200, '=total <= 5000')).toEqual({ min: 0, max: 10000, step: 100 })
    expect(rangeOf(8900, '=total <= 5000')).toEqual({ min: 0, max: 10000, step: 100 })
    expect(rangeOf(12000, '=total <= 5000')).toEqual({ min: 0, max: 20000, step: 200 })
    expect(rangeOf(30, '=total > 2.5')).toEqual({ min: 0, max: 50, step: 0.5 })
    expect(rangeOf(-40)).toEqual({ min: 0, max: 50, step: 0.5 })
    expect(rangeOf(0)).toEqual({ min: 0, max: 1, step: 0.01 })
  })

  it('keeps the range when the slider is dragged to its end and the variables are derived again', () => {
    const conditions = [condition('=total >= 1000', 'total')]
    const rangeOf = (total: number) => {
      const [variable] = deriver.derive(conditions, { total })
      return variable.type === 'number' ? variable.range : undefined
    }

    const { max } = rangeOf(1200)!

    expect(rangeOf(max)).toEqual(rangeOf(1200))
  })

  it('takes the bounds a host sets for a variable over the derived ones', () => {
    const conditions = [condition('=total >= 1000', 'total'), condition('=retries > 3', 'retries')]
    const values = { total: 1200, retries: 1 }

    const [total, retries] = deriver.derive(conditions, values, {
      total: { min: 100, max: 5100 },
      retries: { max: 10, step: 1 },
    })

    expect(total).toEqual({ name: 'total', type: 'number', range: { min: 100, max: 5100, step: 50 } })
    expect(retries).toEqual({ name: 'retries', type: 'number', range: { min: 0, max: 10, step: 1 } })
  })

  it('takes only the numbers of conditions that read the variable, not those in names', () => {
    const conditions = [
      condition('=total > level2Limit', 'total', 'level2Limit'),
      condition('=retries > 900', 'retries'),
    ]

    const [total] = deriver.derive(conditions, { total: 30, retries: 1 })

    expect(total).toEqual({ name: 'total', type: 'number', range: { min: 0, max: 50, step: 0.5 } })
  })
})
