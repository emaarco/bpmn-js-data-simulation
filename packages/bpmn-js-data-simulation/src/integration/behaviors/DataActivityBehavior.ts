import type { DataGateways } from '../DataGateways.js'
import type { BehaviorContext } from '../tokenSimulation.js'

interface ActivityBehavior {
  exit(context: BehaviorContext): void
}

export class DataActivityBehavior {
  static $inject = ['activityBehavior', 'dataGateways']

  constructor(
    behavior: ActivityBehavior,
    private readonly dataGateways: DataGateways,
  ) {
    const exitThroughAllFlows = behavior.exit.bind(behavior)
    behavior.exit = context => {
      const { element, scope } = context
      const completing = scope.active && !scope.failed
      if (!completing || !this.dataGateways.routesActivityByData(element)) {
        exitThroughAllFlows(context)
        return
      }
      this.dataGateways.exitActivity(context, takenFlows =>
        exitThroughAllFlows({ ...context, element: { ...element, outgoing: takenFlows } }),
      )
    }
  }
}
