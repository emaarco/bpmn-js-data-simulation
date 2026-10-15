import type { GatewayKind } from '../../domain/model.js'
import type { DataGateways } from '../DataGateways.js'
import type { BehaviorContext } from '../tokenSimulation.js'

interface GatewayBehavior {
  exit(context: BehaviorContext): void
}

export class DataGatewayBehaviors {
  static $inject = ['exclusiveGatewayBehavior', 'inclusiveGatewayBehavior', 'dataGateways']

  constructor(exclusive: GatewayBehavior, inclusive: GatewayBehavior, dataGateways: DataGateways) {
    routeByData(exclusive, 'exclusive', dataGateways)
    routeByData(inclusive, 'inclusive', dataGateways)
  }
}

function routeByData(behavior: GatewayBehavior, kind: GatewayKind, dataGateways: DataGateways): void {
  const exitByClick = behavior.exit.bind(behavior)
  behavior.exit = context => {
    if (dataGateways.isDataDriven(context.element)) {
      dataGateways.exit(context, kind)
    } else {
      dataGateways.recordClickDecision(context, kind)
      exitByClick(context)
    }
  }
}
