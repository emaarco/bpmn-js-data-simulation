import { DataSimulationStore } from '../simulation/DataSimulationStore.js'
import { DataActivityBehavior } from './behaviors/DataActivityBehavior.js'
import { DataContextPads } from './behaviors/DataContextPads.js'
import { DataGatewayBehaviors } from './behaviors/DataGatewayBehaviors.js'
import { DataGatewaySettings } from './behaviors/DataGatewaySettings.js'
import { MultiInstanceBehaviors } from './behaviors/MultiInstanceBehaviors.js'
import { DataGateways } from './DataGateways.js'
import { DataSimulation } from './DataSimulation.js'
import { DataSimulationOverlays } from './DataSimulationOverlays.js'
import { DataSimulationPanel } from './DataSimulationPanel.js'
import { DataSimulationToggle } from './DataSimulationToggle.js'
import { DataStartForm } from './DataStartForm.js'
import { MultiInstanceActivities } from './MultiInstanceActivities.js'
import { PathSimulation } from './PathSimulation.js'

export interface DataSimulationModuleDeclaration {
  __init__: string[]
  [service: string]: unknown
}

export const PathSimulationModule: DataSimulationModuleDeclaration = {
  __init__: [],
  pathSimulation: ['type', PathSimulation],
}

export const DataSimulationModule: DataSimulationModuleDeclaration = {
  __depends__: [PathSimulationModule],
  __init__: [
    'dataSimulation',
    'dataSimulationOverlays',
    'dataSimulationPanel',
    'dataSimulationToggle',
    'dataGatewayBehaviors',
    'dataActivityBehavior',
    'multiInstanceBehaviors',
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
  dataActivityBehavior: ['type', DataActivityBehavior],
  dataGatewaySettings: ['type', DataGatewaySettings],
  dataContextPads: ['type', DataContextPads],
  multiInstanceActivities: ['type', MultiInstanceActivities],
  multiInstanceBehaviors: ['type', MultiInstanceBehaviors],
}
