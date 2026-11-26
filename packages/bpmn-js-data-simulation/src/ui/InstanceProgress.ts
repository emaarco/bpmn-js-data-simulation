import type { InstanceCount, LoopInstanceStatus, LoopMode } from '../domain/model.js'
import { h } from '../utils/dom.js'

const MAX_DOTS = 12

export class InstanceProgress {
  readonly element = h('span', { className: 'bds-loop' })

  private readonly description: string

  constructor(mode: LoopMode, count: InstanceCount) {
    this.description = this.describe(mode, count)
  }

  show(progress: readonly LoopInstanceStatus[]): void {
    const done = progress.filter(status => status === 'done').length
    const dots =
      progress.length <= MAX_DOTS
        ? progress.map(status =>
            h('span', { className: `bds-loop-dot bds-loop-dot--${status}`, 'data-status': status }),
          )
        : []
    this.element.title = this.description
    this.element.replaceChildren(...dots, h('span', { className: 'bds-loop-count' }, `${done}/${progress.length}`))
  }

  private describe(mode: LoopMode, { count, source, expression, reason }: InstanceCount): string {
    if (!count) return `No instance: ${expression} is empty`
    const instances = `${count} ${mode} instance${count === 1 ? '' : 's'}`
    if (source === 'collection') return `${instances}, one per item of ${expression}`
    if (source === 'cardinality') return `${instances}, loop cardinality ${expression}`
    return reason ? `${instances} (default): ${reason}` : `${instances} (default without data)`
  }
}
