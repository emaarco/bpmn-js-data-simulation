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
  ELEMENT_CHANGED_EVENT,
  type EventBus,
  type Injector,
  type Overlays,
  RESET_SIMULATION_EVENT,
  SCOPE_DESTROYED_EVENT,
  type Scope,
  type ScopeBehavior,
  type Simulator,
  TOGGLE_MODE_EVENT,
  TOKEN_COUNT_OVERLAY,
} from './tokenSimulation.js'

export interface LoopInstanceContext extends BehaviorContext {
  loopIndex: number
}

const PROGRESS_OVERLAY = 'bds-loop-progress'
const PROGRESS_OFFSET_TOP = -26
const BELOW_TOKEN_COUNT = 250
const STAGGER_STEP_LENGTH = 6

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
    eventBus.on(ELEMENT_CHANGED_EVENT, BELOW_TOKEN_COUNT, ({ element }: { element: DiagramElement }) => {
      if (this.loopOf(element)) this.overlays.remove({ element, type: TOKEN_COUNT_OVERLAY })
    })
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
    const runInstance = is(element, 'bpmn:SubProcess')
      ? () => enterActivity(context)
      : () => this.passThrough(element, scope, () => enterActivity(context))
    const staggerSteps = loop?.mode === 'parallel' ? loopIndex : 0
    this.stagger(element, scope, staggerSteps, runInstance)
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

  private passThrough(activity: DiagramElement, scope: Scope, done: () => void): void {
    if (!this.animation) {
      done()
      return
    }
    const entry = this.entryPoint(activity)
    const exit = { x: entry.x + (activity.width ?? 0), y: entry.y }
    this.animation.animate({ waypoints: [entry, exit] }, scope, done)
  }

  private stagger(activity: DiagramElement, scope: Scope, steps: number, done: () => void): void {
    if (!this.animation || !steps) {
      done()
      return
    }
    const entry = this.entryPoint(activity)
    const pause = { waypoints: [entry, { x: entry.x + STAGGER_STEP_LENGTH, y: entry.y }] }
    const waiting = this.animation.createAnimation(pause, scope, () => this.stagger(activity, scope, steps - 1, done))
    if (waiting) waiting.hide()
    else done()
  }

  private entryPoint({ x = 0, y = 0, height = 0 }: DiagramElement): { x: number; y: number } {
    return { x, y: y + height / 2 }
  }
}
