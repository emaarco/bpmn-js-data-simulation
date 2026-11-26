import { isLoopInstance } from '../../utils/diagramElements.js'
import type { LoopInstanceContext, MultiInstanceActivities } from '../MultiInstanceActivities.js'
import type { ActivityBehavior, BehaviorContext } from '../tokenSimulation.js'

export class MultiInstanceBehaviors {
  static $inject = ['activityBehavior', 'subProcessBehavior', 'multiInstanceActivities']

  constructor(
    activity: ActivityBehavior,
    subProcess: ActivityBehavior,
    private readonly multiInstance: MultiInstanceActivities,
  ) {
    this.runInstances(activity)
    this.runInstances(subProcess)
  }

  private runInstances(behavior: ActivityBehavior): void {
    const enterOnce = behavior.enter.bind(behavior)
    const exitOnce = behavior.exit.bind(behavior)
    behavior.enter = context => {
      const loop = this.multiInstance.loopOf(context.element)
      if (!loop) enterOnce(context)
      else if (isLoopInstance(context.scope))
        this.multiInstance.enterInstance(context as LoopInstanceContext, enterOnce)
      else this.multiInstance.enterBody(context, loop)
    }
    behavior.exit = (context: BehaviorContext) => {
      if (this.multiInstance.loopOf(context.element) && isLoopInstance(context.scope)) {
        this.multiInstance.exitInstance(context)
      } else {
        exitOnce(context)
      }
    }
  }
}
