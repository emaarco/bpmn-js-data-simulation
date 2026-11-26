import { describe, expect, it } from 'vitest'
import type { Evaluation, PathFlow, PathGraph, PathNode } from '../../src/domain/model'
import { PathResolver } from '../../src/domain/PathResolver'

const resolver = new PathResolver()

function node(id: string, outgoing: PathFlow[] = [], extra: Partial<PathNode> = {}): PathNode {
  return { id, outgoing, nestedStartIds: [], measures: {}, ...extra }
}

function flow(id: string, targetId: string, expression?: string): PathFlow {
  return { id, targetId, expression, isDefault: false }
}

function conditions(values: Record<string, boolean>) {
  return (expression: string): Evaluation =>
    expression in values ? { ok: true, value: values[expression] } : { ok: false, reason: `unknown ${expression}` }
}

const approval: PathGraph = {
  startIds: ['start'],
  nodes: [
    node('start', [flow('toGateway', 'gateway')]),
    node('gateway', [flow('yes', 'approve', 'small'), { ...flow('no', 'review'), isDefault: true }], {
      routingKind: 'exclusive',
    }),
    node('approve', [flow('toEnd', 'end')], { measures: { duration: 2 } }),
    node('review', [flow('reviewed', 'end')], { measures: { duration: 5 } }),
    node('end'),
  ],
}

describe('PathResolver', () => {
  it('follows the flow the gateway decides on and skips the other branch', () => {
    const resolution = resolver.resolve(approval, conditions({ small: true }))

    expect(resolution.taken).toEqual(['start', 'toGateway', 'gateway', 'yes', 'approve', 'toEnd', 'end'])
    expect(resolution.skipped).toEqual(['no', 'review', 'reviewed'])
    expect(resolution.decisions.gateway.takenFlowIds).toEqual(['yes'])
  })

  it('takes the default flow when no condition is true', () => {
    const resolution = resolver.resolve(approval, conditions({ small: false }))

    expect(resolution.decisions.gateway.takenFlowIds).toEqual(['no'])
    expect(resolution.skipped).toEqual(['yes', 'approve', 'toEnd'])
  })

  it('stops at a gateway that cannot decide and reports why', () => {
    const resolution = resolver.resolve(approval, conditions({}))

    expect(resolution.taken).toEqual(['start', 'toGateway', 'gateway'])
    expect(resolution.decisions.gateway.stuckReason).toBe('Condition of "yes" failed: unknown small')
  })

  it('takes every flow an inclusive gateway decides on', () => {
    const graph: PathGraph = {
      startIds: ['split'],
      nodes: [
        node('split', [flow('a', 'taskA', 'a'), flow('b', 'taskB', 'b'), flow('c', 'taskC', 'c')], {
          routingKind: 'inclusive',
        }),
        node('taskA'),
        node('taskB'),
        node('taskC'),
      ],
    }

    const resolution = resolver.resolve(graph, conditions({ a: true, b: false, c: true }))

    expect(resolution.taken).toEqual(['split', 'a', 'c', 'taskA', 'taskC'])
    expect(resolution.decisions.split.takenFlowIds).toEqual(['a', 'c'])
  })

  it('follows every outgoing flow of a node that is no data gateway', () => {
    const graph: PathGraph = {
      startIds: ['fork'],
      nodes: [node('fork', [flow('left', 'taskA'), flow('right', 'taskB')]), node('taskA'), node('taskB')],
    }

    expect(resolver.resolve(graph, conditions({})).skipped).toEqual([])
  })

  it('routes an activity by the conditions on its flows, even with a single conditional flow', () => {
    const graph: PathGraph = {
      startIds: ['inspect'],
      nodes: [node('inspect', [flow('worn', 'order', 'worn')], { routingKind: 'activity' }), node('order')],
    }

    expect(resolver.resolve(graph, conditions({ worn: true })).taken).toEqual(['inspect', 'worn', 'order'])
    const stuck = resolver.resolve(graph, conditions({ worn: false }))
    expect(stuck.taken).toEqual(['inspect'])
    expect(stuck.decisions.inspect.stuckReason).toBe('No condition is true and there is no default flow')
  })

  it('stops at an activity whose conditional flows the engine refuses', () => {
    const graph: PathGraph = {
      startIds: ['inspect'],
      nodes: [
        node('inspect', [flow('worn', 'order', 'worn')], {
          routingKind: 'activity',
          refusalReason: 'Only at gateways',
        }),
        node('order'),
      ],
    }

    const resolution = resolver.resolve(graph, conditions({ worn: true }))

    expect(resolution.taken).toEqual(['inspect'])
    expect(resolution.decisions.inspect).toMatchObject({ stuckReason: 'Only at gateways', refusedByEngine: true })
  })

  it('enters a sub-process at its start event', () => {
    const graph: PathGraph = {
      startIds: ['start'],
      nodes: [
        node('start', [flow('toSub', 'sub')]),
        node('sub', [], { nestedStartIds: ['innerStart'] }),
        node('innerStart', [flow('toInner', 'inner')]),
        node('inner'),
        node('boundary', [flow('escalate', 'inner')]),
      ],
    }

    const resolution = resolver.resolve(graph, conditions({}))

    expect(resolution.taken).toEqual(['start', 'toSub', 'sub', 'innerStart', 'toInner', 'inner'])
    expect(resolution.skipped).toEqual(['boundary', 'escalate'])
  })

  it('walks a loop once', () => {
    const graph: PathGraph = {
      startIds: ['task'],
      nodes: [
        node('task', [flow('toCheck', 'check')]),
        node('check', [flow('again', 'task', 'retry'), { ...flow('done', 'end'), isDefault: true }], {
          routingKind: 'exclusive',
        }),
        node('end'),
      ],
    }

    const resolution = resolver.resolve(graph, conditions({ retry: true }))

    expect(resolution.taken).toEqual(['task', 'toCheck', 'check', 'again'])
  })

  it('sums the measures of the nodes on the path', () => {
    expect(resolver.resolve(approval, conditions({ small: true })).measures).toEqual({ duration: 2 })
    expect(resolver.resolve(approval, conditions({ small: false })).measures).toEqual({ duration: 5 })
  })
})
