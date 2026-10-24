import { describe, expect, it } from 'vitest'
import type { ElementVariableUsage } from '../../src/domain/model'
import { StartFieldDeriver } from '../../src/domain/StartFieldDeriver'

function usage(elementName: string, overrides: Partial<ElementVariableUsage>): ElementVariableUsage {
  return {
    elementName,
    conditionReads: [],
    inputReads: [],
    inputTargets: [],
    outputReads: [],
    outputTargets: [],
    ...overrides,
  }
}

const deriver = new StartFieldDeriver()

describe('StartFieldDeriver', () => {
  it('asks for variables that conditions and input mappings read but the process does not write', () => {
    const fields = deriver.derive([
      usage('Check credit', {
        inputReads: ['customer'],
        inputTargets: ['customerId'],
        outputTargets: ['creditworthy'],
      }),
      usage('Credit OK?', { conditionReads: ['creditworthy', 'orderTotal'] }),
      usage('Extras?', { conditionReads: ['orderTotal', 'insurance'] }),
    ])

    expect(fields).toEqual([
      { name: 'customer', type: 'auto', usedBy: ['Check credit'] },
      { name: 'orderTotal', type: 'auto', usedBy: ['Credit OK?', 'Extras?'] },
      { name: 'insurance', type: 'auto', usedBy: ['Extras?'] },
    ])
  })

  it('skips nested output targets, local inputs and task results', () => {
    const fields = deriver.derive(
      [
        usage('Invoice', { inputReads: ['local'], inputTargets: ['local'], outputTargets: ['order.total'] }),
        usage('Approved?', { conditionReads: ['order', 'approved'] }),
      ],
      { taskResultNames: ['approved'] },
    )

    expect(fields).toEqual([])
  })

  it('asks for what output mappings read, unless a task result or a local input provides it', () => {
    const usages = [
      usage('Check credit', {
        inputTargets: ['agency'],
        outputReads: ['score', 'agency'],
        outputTargets: ['creditScore', 'creditworthy'],
      }),
    ]

    expect(deriver.derive(usages).map(({ name }) => name)).toEqual(['score'])
    expect(deriver.derive(usages, { taskResultNames: ['score'] })).toEqual([])
  })

  it('infers the field type from example values', () => {
    const fields = deriver.derive([usage('Gateway', { conditionReads: ['a', 'b', 'c', 'd', 'e'] })], {
      examples: [{ a: 1 }, { b: true, c: 'text', d: ['x'] }],
    })

    expect(fields.map(({ name, type }) => [name, type])).toEqual([
      ['a', 'number'],
      ['b', 'boolean'],
      ['c', 'text'],
      ['d', 'json'],
      ['e', 'auto'],
    ])
  })
})
