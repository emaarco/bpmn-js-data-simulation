import type { DataGateways } from '../DataGateways.js'
import type { DataSimulation } from '../DataSimulation.js'
import type { DataStartForm } from '../DataStartForm.js'
import type { DiagramElement } from '../tokenSimulation.js'

interface ContextPad {
  element: DiagramElement
  action?: (contexts: unknown) => unknown
  [property: string]: unknown
}

interface ContextPadHandler {
  createContextPads(element: DiagramElement): Array<ContextPad | undefined> | ContextPad | undefined
}

interface ContextPads {
  _handlers: Array<{ handler: ContextPadHandler; type: string }>
}

const FLOW_CHOICE_TYPES = ['bpmn:ExclusiveGateway', 'bpmn:InclusiveGateway']
const TRIGGER_TYPE = 'bpmn:Event'

export class DataContextPads {
  static $inject = ['contextPads', 'dataGateways', 'dataStartForm', 'dataSimulation']

  constructor(
    contextPads: ContextPads,
    dataGateways: DataGateways,
    startForm: DataStartForm,
    dataSimulation: DataSimulation,
  ) {
    for (const { handler, type } of contextPads._handlers) {
      if (FLOW_CHOICE_TYPES.includes(type)) hideOnDataDrivenGateways(handler, dataGateways)
      if (type === TRIGGER_TYPE) openStartFormOnProcessStart(handler, startForm, dataSimulation)
    }
  }
}

function hideOnDataDrivenGateways(handler: ContextPadHandler, dataGateways: DataGateways): void {
  const createContextPads = handler.createContextPads.bind(handler)
  handler.createContextPads = element => (dataGateways.isDataDriven(element) ? undefined : createContextPads(element))
}

function openStartFormOnProcessStart(
  handler: ContextPadHandler,
  startForm: DataStartForm,
  dataSimulation: DataSimulation,
): void {
  const createContextPads = handler.createContextPads.bind(handler)
  handler.createContextPads = element => {
    const pads = createContextPads(element)
    if (!dataSimulation.isEnabled() || !startForm.isProcessStart(element)) return pads
    return ([] as Array<ContextPad | undefined>)
      .concat(pads)
      .map(pad =>
        pad?.action
          ? { ...pad, action: (contexts: unknown) => startForm.open(element, () => pad.action!(contexts)) }
          : pad,
      )
  }
}
