import { describe, expect, it } from 'vitest'
import { InstanceLoop } from '../../src/domain/InstanceLoop'

describe('InstanceLoop', () => {
  it('starts all parallel instances at once and finishes after the last one', () => {
    const loop = new InstanceLoop('parallel', 3)

    expect(loop.start()).toEqual([0, 1, 2])
    expect(loop.progress).toEqual(['running', 'running', 'running'])

    expect(loop.complete(1)).toBeUndefined()
    expect(loop.complete(0)).toBeUndefined()
    expect(loop.finished).toBe(false)
    expect(loop.complete(2)).toBeUndefined()
    expect(loop.finished).toBe(true)
  })

  it('starts sequential instances one after the other', () => {
    const loop = new InstanceLoop('sequential', 3)

    expect(loop.start()).toEqual([0])
    expect(loop.progress).toEqual(['running', 'waiting', 'waiting'])
    expect(loop.complete(0)).toBe(1)
    expect(loop.progress).toEqual(['done', 'running', 'waiting'])
    expect(loop.complete(1)).toBe(2)
    expect(loop.complete(2)).toBeUndefined()
    expect(loop.finished).toBe(true)
  })

  it('starts nothing and is finished without instances', () => {
    const loop = new InstanceLoop('sequential', 0)

    expect(loop.start()).toEqual([])
    expect(loop.finished).toBe(true)
  })
})
