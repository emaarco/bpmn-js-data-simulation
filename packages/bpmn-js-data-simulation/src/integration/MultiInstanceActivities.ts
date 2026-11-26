import { InstanceCounter } from '../domain/InstanceCounter.js'
import { InstanceLoop } from '../domain/InstanceLoop.js'
import type { InstanceCount, MultiInstanceLoop } from '../domain/model.js'
import { is } from '../utils/diagramElements.js'
import type { DataSimulation } from './DataSimulation.js'
import {
  type Animation,
  type BehaviorContext,
  type DiagramElement,
  type EventBus,
  type Injector,
  RESET_SIMULATION_EVENT,
  SCOPE_DESTROYED_EVENT,
  type Scope,
  type ScopeBehavior,
  type Simulator,
  TOGGLE_MODE_EVENT,
} from './tokenSimulation.js'

export interface LoopInstanceContext extends BehaviorContext {
  loopIndex: number
}

const WORK_INSET = 20
const MAX_WORK_STEPS = 3

export class MultiInstanceActivities {
  static $inject = ['dataSimulation', 'simulator', 'scopeBehavior', 'eventBus', 'injector']

  private readonly counter = new InstanceCounter()
  private readonly loops = new Map<string, InstanceLoop>()
  private readonly instanceIndexes = new WeakMap<Scope, number>()
  private readonly animation: Animation | undefined

  constructor(
    private readonly dataSimulation: DataSimulation,
    private readonly simulator: Simulator,
    private readonly scopeBehavior: ScopeBehavior,
    eventBus: EventBus,
    injector: Injector,
  ) {
    this.animation = injector.get('animation', false) as Animation | undefined
    eventBus.on(SCOPE_DESTROYED_EVENT, ({ scope }: { scope: Scope }) => this.loops.delete(scope.id))
    eventBus.on([RESET_SIMULATION_EVENT, TOGGLE_MODE_EVENT], () => this.loops.clear())
  }

  loopOf(activity: DiagramElement): MultiInstanceLoop | undefined {
    return this.dataSimulation.getEngine().readLoop?.(activity.businessObject)
  }

  enterBody(context: BehaviorContext, loop: MultiInstanceLoop): void {
    const { element, scope: body } = context
    const { count } = this.count(body, loop)
    if (!count) {
      this.simulator.exit(context)
      return
    }
    const instanceLoop = new InstanceLoop(loop.mode, count)
    this.loops.set(body.id, instanceLoop)
    for (const index of instanceLoop.start()) this.startInstance(element, body, index)
  }

  enterInstance(context: LoopInstanceContext, enterActivity: (context: BehaviorContext) => void): void {
    const { element, scope, loopIndex } = context
    const loop = this.loops.get(scope.parent!.id)
    this.instanceIndexes.set(scope, loopIndex)
    if (!loop || is(element, 'bpmn:SubProcess')) {
      enterActivity(context)
      return
    }
    const steps = loop.mode === 'parallel' ? 1 + (loopIndex % MAX_WORK_STEPS) : 1
    this.work(element, scope, loopIndex, loop.progress.length, steps, () => enterActivity(context))
  }

  exitInstance({ element, scope }: BehaviorContext): void {
    const body = scope.parent!
    const loop = this.loops.get(body.id)
    if (!loop) return
    const next = loop.complete(this.instanceIndexes.get(scope)!)
    if (next !== undefined) this.startInstance(element, body, next)
    if (loop.finished) {
      this.loops.delete(body.id)
      this.scopeBehavior.tryExit(body, scope)
    }
  }

  private count(body: Scope, loop: MultiInstanceLoop): InstanceCount {
    if (!this.dataSimulation.isEnabled()) return this.counter.count(loop)
    const engine = this.dataSimulation.getEngine()
    const variables = this.dataSimulation.getVariables(body)
    return this.counter.count(loop, expression => engine.evaluate(expression, variables))
  }

  private startInstance(activity: DiagramElement, body: Scope, index: number): void {
    this.simulator.enter({ element: activity, scope: body, initiator: body, loopIndex: index })
  }

  private work(activity: DiagramElement, scope: Scope, lane: number, lanes: number, steps: number, done: () => void) {
    if (!this.animation || !steps) {
      done()
      return
    }
    const path = { waypoints: this.workPath(activity, lane, lanes, steps % 2 === 0) }
    this.animation.animate(path, scope, () => this.work(activity, scope, lane, lanes, steps - 1, done))
  }

  private workPath(activity: DiagramElement, lane: number, lanes: number, backwards: boolean) {
    const { x = 0, y = 0, width = 0, height = 0 } = activity
    const laneY = y + WORK_INSET + ((height - 2 * WORK_INSET) * (lane + 0.5)) / lanes
    const start = { x: x + WORK_INSET, y: laneY }
    const end = { x: x + width - WORK_INSET, y: laneY }
    return backwards ? [end, start] : [start, end]
  }
}
