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

  constructor(exclusive: ExclusiveGatewaySettings, inclusive: InclusiveGatewaySettings, dataGateways: DataGateways) {
    const onlyForClickGateways = (method: GatewayMethod): GatewayMethod => {
      return (gateway, ...rest) => {
        if (!dataGateways.isDataDriven(gateway)) method(gateway, ...rest)
      }
    }
    exclusive.setSequenceFlow = onlyForClickGateways(exclusive.setSequenceFlow.bind(exclusive))
    inclusive._setGatewayDefaults = onlyForClickGateways(inclusive._setGatewayDefaults.bind(inclusive))
    inclusive.toggleSequenceFlow = onlyForClickGateways(inclusive.toggleSequenceFlow.bind(inclusive))
  }
}
