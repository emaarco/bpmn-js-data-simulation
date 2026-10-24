import type { DataGateways } from '../DataGateways.js'
import type { DiagramElement } from '../tokenSimulation.js'

type GatewayMethod = (gateway: DiagramElement, ...rest: never[]) => void

interface ExclusiveGatewaySettings {
  setSequenceFlow: GatewayMethod
}

interface InclusiveGatewaySettings {
  _setGatewayDefaults: GatewayMethod
  toggleSequenceFlow: GatewayMethod
}

export class DataGatewaySettings {
  static $inject = ['exclusiveGatewaySettings', 'inclusiveGatewaySettings', 'dataGateways']

  constructor(
    exclusive: ExclusiveGatewaySettings,
    inclusive: InclusiveGatewaySettings,
    private readonly dataGateways: DataGateways,
  ) {
    exclusive.setSequenceFlow = this.onlyForClickGateways(exclusive.setSequenceFlow.bind(exclusive))
    inclusive._setGatewayDefaults = this.onlyForClickGateways(inclusive._setGatewayDefaults.bind(inclusive))
    inclusive.toggleSequenceFlow = this.onlyForClickGateways(inclusive.toggleSequenceFlow.bind(inclusive))
  }

  private onlyForClickGateways(method: GatewayMethod): GatewayMethod {
    return (gateway, ...rest) => {
      if (!this.dataGateways.isDataDriven(gateway)) method(gateway, ...rest)
    }
  }
}
