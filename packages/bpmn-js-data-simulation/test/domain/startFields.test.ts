import { describe, expect, it } from 'vitest'
import {
  applyFieldValues,
  deriveStartFields,
  type ElementVariableUsage,
  formatFieldValue,
  parseFieldValue,
  type StartField,
} from '../../src/domain/startFields'

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

function field(type: StartField['type']): StartField {
  return { name: 'value', type, usedBy: [] }
}

describe('deriveStartFields', () => {
  it('asks for variables that conditions and input mappings read but the process does not write', () => {
    const fields = deriveStartFields([
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
    const fields = deriveStartFields(
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

    expect(deriveStartFields(usages).map(({ name }) => name)).toEqual(['score'])
    expect(deriveStartFields(usages, { taskResultNames: ['score'] })).toEqual([])
  })

  it('infers the field type from example values', () => {
    const fields = deriveStartFields([usage('Gateway', { conditionReads: ['a', 'b', 'c', 'd', 'e'] })], {
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

describe('field values', () => {
  it.each([
    ['number', '42', { ok: true, value: 42 }],
    ['number', 'x', { ok: false, reason: 'value must be a number' }],
    ['json', '["a"]', { ok: true, value: ['a'] }],
    ['json', '[', { ok: false, reason: 'value must be valid JSON' }],
    ['auto', '12', { ok: true, value: 12 }],
    ['auto', 'gold', { ok: true, value: 'gold' }],
    ['text', '12', { ok: true, value: '12' }],
    ['text', '   ', { ok: true, value: undefined }],
  ] as const)('parses a %s field from %j', (type, raw, expected) => {
    expect(parseFieldValue(field(type), raw)).toEqual(expected)
  })

  it('formats values for the inputs', () => {
    expect(formatFieldValue(field('boolean'), true)).toBe(true)
    expect(formatFieldValue(field('number'), 5)).toBe('5')
    expect(formatFieldValue(field('json'), { a: 1 })).toBe('{"a":1}')
    expect(formatFieldValue(field('auto'), 'gold')).toBe('gold')
    expect(formatFieldValue(field('text'), undefined)).toBe('')
  })

  it('applies field values on top of the scenario variables and drops emptied fields', () => {
    expect(
      applyFieldValues({ bikeId: 'MV-1', orderTotal: 1, insurance: true }, { orderTotal: 2, insurance: undefined }),
    ).toEqual({
      bikeId: 'MV-1',
      orderTotal: 2,
    })
  })
})
