// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { InstanceProgress } from '../../src/ui/InstanceProgress'

function statusesOf(progress: InstanceProgress): string[] {
  return [...progress.element.querySelectorAll<HTMLElement>('.bds-loop-dot')].map(dot => dot.dataset.status!)
}

describe('InstanceProgress', () => {
  it('shows one dot per instance and how many are done', () => {
    const progress = new InstanceProgress('parallel', { count: 3, source: 'collection', expression: '=bikes' })
    progress.show(['done', 'running', 'waiting'])

    expect(statusesOf(progress)).toEqual(['done', 'running', 'waiting'])
    expect(progress.element.querySelector('.bds-loop-count')!.textContent).toBe('1/3')
    expect(progress.element.title).toBe('3 parallel instances, one per item of =bikes')
  })

  it('shows only the count when there are too many instances for dots', () => {
    const progress = new InstanceProgress('sequential', { count: 20, source: 'cardinality', expression: '${20}' })
    progress.show(Array.from({ length: 20 }, () => 'waiting' as const))

    expect(statusesOf(progress)).toEqual([])
    expect(progress.element.textContent).toBe('0/20')
    expect(progress.element.title).toBe('20 sequential instances, loop cardinality ${20}')
  })

  it.each([
    [{ count: 0, source: 'collection', expression: '=bikes' }, 'No instance: =bikes is empty'],
    [{ count: 3, source: 'default' }, '3 parallel instances (default without data)'],
    [
      { count: 3, source: 'default', expression: '=sites', reason: "Variable 'sites' not found" },
      "3 parallel instances (default): Variable 'sites' not found",
    ],
  ] as const)('explains where the count %j comes from', (count, title) => {
    const progress = new InstanceProgress('parallel', count)
    progress.show([])

    expect(progress.element.title).toBe(title)
  })
})
