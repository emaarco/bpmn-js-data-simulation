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

  it('spans the slider over twice the larger of the value and the numbers it is compared with', () => {
    const rangeOf = (value: number, expression = '=total > 0') => {
      const [variable] = deriver.derive([condition(expression, 'total')], { total: value })
      return variable.type === 'number' ? variable.range : undefined
    }

    expect(rangeOf(1200, '=total <= 5000')).toEqual({ min: 0, max: 10000, step: 100 })
    expect(rangeOf(8900, '=total <= 5000')).toEqual({ min: 0, max: 20000, step: 200 })
    expect(rangeOf(30, '=total > 2.5')).toEqual({ min: 0, max: 100, step: 1 })
    expect(rangeOf(-40)).toEqual({ min: 0, max: 100, step: 1 })
    expect(rangeOf(0)).toEqual({ min: 0, max: 1, step: 0.01 })
  })

  it('takes only the numbers of conditions that read the variable, not those in names', () => {
    const conditions = [
      condition('=total > level2Limit', 'total', 'level2Limit'),
      condition('=retries > 900', 'retries'),
    ]

    const [total] = deriver.derive(conditions, { total: 30, retries: 1 })

    expect(total).toEqual({ name: 'total', type: 'number', range: { min: 0, max: 100, step: 1 } })
  })
})
