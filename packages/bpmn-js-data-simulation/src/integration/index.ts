import { DataSimulationStore } from '../simulation/DataSimulationStore.js'
import { DataContextPads } from './behaviors/DataContextPads.js'
import { DataGatewayBehaviors } from './behaviors/DataGatewayBehaviors.js'
import { DataGatewaySettings } from './behaviors/DataGatewaySettings.js'
import { DataGateways } from './DataGateways.js'
import { DataSimulation } from './DataSimulation.js'
import { DataSimulationOverlays } from './DataSimulationOverlays.js'
import { DataSimulationPanel } from './DataSimulationPanel.js'
import { DataSimulationToggle } from './DataSimulationToggle.js'
import { DataStartForm } from './DataStartForm.js'

export interface DataSimulationModuleDeclaration {
  __init__: string[]
  [service: string]: unknown
}

const DataSimulationModule: DataSimulationModuleDeclaration = {
  __init__: [
    'dataSimulation',
    'dataSimulationOverlays',
    'dataSimulationPanel',
    'dataSimulationToggle',
    'dataGatewayBehaviors',
    'dataGatewaySettings',
    'dataContextPads',
  ],
  dataSimulationStore: ['type', DataSimulationStore],
  dataSimulation: ['type', DataSimulation],
  dataSimulationOverlays: ['type', DataSimulationOverlays],
  dataSimulationPanel: ['type', DataSimulationPanel],
  dataSimulationToggle: ['type', DataSimulationToggle],
  dataGateways: ['type', DataGateways],
  dataStartForm: ['type', DataStartForm],
  dataGatewayBehaviors: ['type', DataGatewayBehaviors],
  dataGatewaySettings: ['type', DataGatewaySettings],
  dataContextPads: ['type', DataContextPads],
}

export default DataSimulationModule
