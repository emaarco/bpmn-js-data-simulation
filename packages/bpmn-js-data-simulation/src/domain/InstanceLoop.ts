import type { LoopInstanceStatus, LoopMode } from './model.js'

export class InstanceLoop {
  private readonly statuses: LoopInstanceStatus[]

  constructor(
    readonly mode: LoopMode,
    count: number,
  ) {
    this.statuses = Array.from({ length: count }, () => 'waiting')
  }

  get progress(): readonly LoopInstanceStatus[] {
    return this.statuses
  }

  get finished(): boolean {
    return this.statuses.every(status => status === 'done')
  }

  start(): number[] {
    const first = this.mode === 'parallel' ? this.statuses.map((_, index) => index) : [0]
    return first.filter(index => index < this.statuses.length).map(index => this.run(index))
  }

  complete(index: number): number | undefined {
    this.statuses[index] = 'done'
    const next = this.statuses.indexOf('waiting')
    return this.mode === 'sequential' && next >= 0 ? this.run(next) : undefined
  }

  private run(index: number): number {
    this.statuses[index] = 'running'
    return index
  }
}
