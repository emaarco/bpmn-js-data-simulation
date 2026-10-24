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
    private readonly dataGateways: DataGateways,
    private readonly startForm: DataStartForm,
    private readonly dataSimulation: DataSimulation,
  ) {
    for (const { handler, type } of contextPads._handlers) {
      if (FLOW_CHOICE_TYPES.includes(type)) this.hideOnDataDrivenGateways(handler)
      if (type === TRIGGER_TYPE) this.openStartFormOnProcessStart(handler)
    }
  }

  private hideOnDataDrivenGateways(handler: ContextPadHandler): void {
    const createContextPads = handler.createContextPads.bind(handler)
    handler.createContextPads = element =>
      this.dataGateways.isDataDriven(element) ? undefined : createContextPads(element)
  }

  private openStartFormOnProcessStart(handler: ContextPadHandler): void {
    const createContextPads = handler.createContextPads.bind(handler)
    handler.createContextPads = element => {
      const pads = createContextPads(element)
      if (!this.dataSimulation.isEnabled() || !this.startForm.isProcessStart(element)) return pads
      return ([] as Array<ContextPad | undefined>)
        .concat(pads)
        .map(pad =>
          pad?.action
            ? { ...pad, action: (contexts: unknown) => this.startForm.open(element, () => pad.action!(contexts)) }
            : pad,
        )
    }
  }
}
