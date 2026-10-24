import { describe, expect, it } from 'vitest'
import type { StartField } from '../../src/domain/model'
import { StartFieldCodec } from '../../src/domain/StartFieldCodec'

function field(type: StartField['type']): StartField {
  return { name: 'value', type, usedBy: [] }
}

const codec = new StartFieldCodec()

describe('StartFieldCodec', () => {
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
    expect(codec.parse(field(type), raw)).toEqual(expected)
  })

  it('formats values for the inputs', () => {
    expect(codec.format(field('boolean'), true)).toBe(true)
    expect(codec.format(field('number'), 5)).toBe('5')
    expect(codec.format(field('json'), { a: 1 })).toBe('{"a":1}')
    expect(codec.format(field('auto'), 'gold')).toBe('gold')
    expect(codec.format(field('text'), undefined)).toBe('')
  })

  it('applies field values on top of the scenario variables and drops emptied fields', () => {
    expect(
      codec.apply({ bikeId: 'MV-1', orderTotal: 1, insurance: true }, { orderTotal: 2, insurance: undefined }),
    ).toEqual({
      bikeId: 'MV-1',
      orderTotal: 2,
    })
  })
})
