import { describe, expect, it } from 'vitest'
import { InstanceCounter } from '../../src/domain/InstanceCounter'
import type { Evaluation } from '../../src/domain/model'

const counter = new InstanceCounter()

function evaluating(values: Record<string, Evaluation>) {
  return (expression: string): Evaluation => values[expression]
}

describe('InstanceCounter', () => {
  it('counts the items of the input collection', () => {
    const count = counter.count(
      { mode: 'parallel', collection: '=bikes' },
      evaluating({ '=bikes': { ok: true, value: ['a', 'b', 'c', 'd'] } }),
    )

    expect(count).toEqual({ count: 4, source: 'collection', expression: '=bikes' })
  })

  it('prefers the loop cardinality over the collection', () => {
    const count = counter.count(
      { mode: 'sequential', cardinality: '=2', collection: '=bikes' },
      evaluating({ '=2': { ok: true, value: 2 } }),
    )

    expect(count).toEqual({ count: 2, source: 'cardinality', expression: '=2' })
  })

  it('reads a cardinality written as plain text', () => {
    expect(
      counter.count({ mode: 'parallel', cardinality: '5' }, evaluating({ '5': { ok: true, value: '5' } })),
    ).toEqual({ count: 5, source: 'cardinality', expression: '5' })
  })

  it('runs no instance for an empty collection', () => {
    expect(counter.count({ mode: 'parallel', collection: '=[]' }, () => ({ ok: true, value: [] })).count).toBe(0)
  })

  it('falls back to 3 instances when the loop names neither cardinality nor collection', () => {
    expect(counter.count({ mode: 'parallel' }, () => ({ ok: true, value: 1 }))).toEqual({ count: 3, source: 'default' })
  })

  it('falls back to 3 instances without data', () => {
    expect(counter.count({ mode: 'parallel', collection: '=bikes' })).toEqual({ count: 3, source: 'default' })
  })

  it('falls back to 3 instances and says why when the collection cannot be read', () => {
    const count = counter.count({ mode: 'sequential', collection: '=sites' }, () => ({
      ok: false,
      reason: "Variable 'sites' not found",
    }))

    expect(count).toEqual({
      count: 3,
      source: 'default',
      expression: '=sites',
      reason: "Variable 'sites' not found",
    })
  })

  it('falls back when the collection is not a list', () => {
    const count = counter.count({ mode: 'parallel', collection: '=bike' }, () => ({ ok: true, value: { id: 1 } }))

    expect(count).toMatchObject({ count: 3, source: 'default', reason: 'Collection {"id":1} is not a list' })
  })

  it.each([-1, 1.5, 'many', null])('falls back when the cardinality is %j', value => {
    const count = counter.count({ mode: 'parallel', cardinality: '=n' }, () => ({ ok: true, value }))

    expect(count).toMatchObject({ count: 3, source: 'default' })
    expect(count.reason).toMatch(/is not a whole number/)
  })
})
