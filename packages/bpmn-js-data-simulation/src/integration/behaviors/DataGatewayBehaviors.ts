import type { GatewayKind } from '../../domain/model.js'
import type { DataGateways } from '../DataGateways.js'
import type { BehaviorContext } from '../tokenSimulation.js'

interface GatewayBehavior {
  exit(context: BehaviorContext): void
}

export class DataGatewayBehaviors {
  static $inject = ['exclusiveGatewayBehavior', 'inclusiveGatewayBehavior', 'dataGateways']

  constructor(
    exclusive: GatewayBehavior,
    inclusive: GatewayBehavior,
    private readonly dataGateways: DataGateways,
  ) {
    this.routeByData(exclusive, 'exclusive')
    this.routeByData(inclusive, 'inclusive')
  }

  private routeByData(behavior: GatewayBehavior, kind: GatewayKind): void {
    const exitByClick = behavior.exit.bind(behavior)
    behavior.exit = context => {
      if (this.dataGateways.isDataDriven(context.element)) {
        this.dataGateways.exit(context, kind)
      } else {
        this.dataGateways.recordClickDecision(context, kind)
        exitByClick(context)
      }
    }
  }
}
