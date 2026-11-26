import { InstanceCounter } from '../domain/InstanceCounter.js'
import { InstanceLoop } from '../domain/InstanceLoop.js'
import type { InstanceCount, MultiInstanceLoop } from '../domain/model.js'
import type { DataSimulationStore } from '../simulation/DataSimulationStore.js'
import { InstanceProgress } from '../ui/InstanceProgress.js'
import { elementName, findProcessInstance, is } from '../utils/diagramElements.js'
import { inShadow } from '../utils/shadow.js'
import type { DataSimulation } from './DataSimulation.js'
import {
  type Animation,
  type BehaviorContext,
  type DiagramElement,
  type EventBus,
  type Injector,
  type Overlays,
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

const PROGRESS_OVERLAY = 'bds-loop-progress'
const PROGRESS_OFFSET_TOP = -20
const WORK_INSET_X = 20
const WORK_INSET_Y = 12
const MAX_WORK_STEPS = 3

export class MultiInstanceActivities {
  static $inject = [
    'dataSimulation',
    'dataSimulationStore',
    'simulator',
    'scopeBehavior',
    'overlays',
    'eventBus',
    'injector',
  ]

  private readonly counter = new InstanceCounter()
  private readonly loops = new Map<string, { loop: InstanceLoop; progress: InstanceProgress }>()
  private readonly instanceIndexes = new WeakMap<Scope, number>()
  private readonly animation: Animation | undefined

  constructor(
    private readonly dataSimulation: DataSimulation,
    private readonly store: DataSimulationStore,
    private readonly simulator: Simulator,
    private readonly scopeBehavior: ScopeBehavior,
    private readonly overlays: Overlays,
    eventBus: EventBus,
    injector: Injector,
  ) {
    this.animation = injector.get('animation', false) as Animation | undefined
    eventBus.on(SCOPE_DESTROYED_EVENT, ({ scope }: { scope: Scope }) => this.loops.delete(scope.id))
    eventBus.on([RESET_SIMULATION_EVENT, TOGGLE_MODE_EVENT], () => {
      this.loops.clear()
      this.overlays.remove({ type: PROGRESS_OVERLAY })
    })
  }

  loopOf(activity: DiagramElement): MultiInstanceLoop | undefined {
    return this.dataSimulation.getEngine().readLoop?.(activity.businessObject)
  }

  enterBody(context: BehaviorContext, loop: MultiInstanceLoop): void {
    const { element, scope: body } = context
    const count = this.count(body, loop)
    this.record(element, body, loop, count)
    const instanceLoop = new InstanceLoop(loop.mode, count.count)
    const progress = this.showProgress(element, new InstanceProgress(loop.mode, count))
    if (!count.count) {
      progress.show(instanceLoop.progress)
      this.simulator.exit(context)
      return
    }
    this.loops.set(body.id, { loop: instanceLoop, progress })
    for (const index of instanceLoop.start()) this.startInstance(element, body, index)
    progress.show(instanceLoop.progress)
  }

  enterInstance(context: LoopInstanceContext, enterActivity: (context: BehaviorContext) => void): void {
    const { element, scope, loopIndex } = context
    const loop = this.loops.get(scope.parent!.id)?.loop
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
    const run = this.loops.get(body.id)
    if (!run) return
    const { loop, progress } = run
    const next = loop.complete(this.instanceIndexes.get(scope)!)
    if (next !== undefined) this.startInstance(element, body, next)
    progress.show(loop.progress)
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

  private record(activity: DiagramElement, body: Scope, { mode }: MultiInstanceLoop, count: InstanceCount): void {
    const instanceId = findProcessInstance(body).id
    if (!this.dataSimulation.isEnabled() || !this.store.hasInstance(instanceId)) return
    this.store.record({
      kind: 'multi-instance',
      instanceId,
      elementId: activity.id,
      elementName: elementName(activity),
      mode,
      count,
    })
  }

  private showProgress(activity: DiagramElement, progress: InstanceProgress): InstanceProgress {
    this.overlays.remove({ element: activity, type: PROGRESS_OVERLAY })
    this.overlays.add(activity, PROGRESS_OVERLAY, {
      position: { top: PROGRESS_OFFSET_TOP, left: 0 },
      scale: { min: 1 },
      html: inShadow(progress.element),
    })
    return progress
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
    const laneY = y + WORK_INSET_Y + ((height - 2 * WORK_INSET_Y) * (lane + 0.5)) / lanes
    const start = { x: x + WORK_INSET_X, y: laneY }
    const end = { x: x + width - WORK_INSET_X, y: laneY }
    return backwards ? [end, start] : [start, end]
  }
}
