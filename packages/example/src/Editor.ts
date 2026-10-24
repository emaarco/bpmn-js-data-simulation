import 'bpmn-js/dist/assets/diagram-js.css'
import 'bpmn-js/dist/assets/bpmn-js.css'
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css'
import '@bpmn-io/properties-panel/dist/assets/properties-panel.css'
import 'bpmn-js-token-simulation/assets/css/bpmn-js-token-simulation.css'
import '@emaarco/bpmn-js-data-simulation/assets/bpmn-js-data-simulation.css'

import DataSimulationModule, { type DataSimulation, type EngineId } from '@emaarco/bpmn-js-data-simulation'
import BpmnModeler from 'bpmn-js/lib/Modeler'
import {
  BpmnPropertiesPanelModule,
  BpmnPropertiesProviderModule,
  CamundaPlatformPropertiesProviderModule,
  ZeebePropertiesProviderModule,
} from 'bpmn-js-properties-panel'
import TokenSimulationModule from 'bpmn-js-token-simulation'
import CamundaPlatformBehaviorsModule from 'camunda-bpmn-js-behaviors/lib/camunda-platform'
import ZeebeBehaviorsModule from 'camunda-bpmn-js-behaviors/lib/camunda-cloud'
import camundaModdle from 'camunda-bpmn-moddle/resources/camunda.json'
import zeebeModdle from 'zeebe-bpmn-moddle/resources/zeebe.json'
import { ZEEBE_NAMESPACE } from './utils/detectEngine'

const ENGINE_SETUP: Record<EngineId, { modules: unknown[]; moddleExtensions: Record<string, any> }> = {
  zeebe: {
    modules: [ZeebePropertiesProviderModule, ZeebeBehaviorsModule],
    moddleExtensions: { zeebe: zeebeModdle },
  },
  camunda7: {
    modules: [CamundaPlatformPropertiesProviderModule, CamundaPlatformBehaviorsModule],
    moddleExtensions: { camunda: camundaModdle },
  },
}

export const BLANK_BPMN = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:zeebe="${ZEEBE_NAMESPACE}" id="Definitions_Blank" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_Blank" name="Neuer Prozess" isExecutable="true">
    <bpmn:startEvent id="StartEvent_1" name="Start" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_Blank">
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1">
        <dc:Bounds x="180" y="160" width="36" height="36" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`

export interface Model {
  xml: string
  engine: EngineId
  scenarios?: unknown
}

type ChangeListener = () => void

interface Box {
  x: number
  y: number
  width: number
  height: number
}

interface Canvas {
  resized(): void
  viewbox(): { inner: Box; outer: Box }
  viewbox(box: Box): void
}

const FIT_PADDING = 40
const PALETTE_SPACE = 70
const MIN_SCALE_WITH_CONTEXT_PADS = 0.5

interface ToggleMode {
  toggleMode(active: boolean): void
}

export class Editor {
  modeler!: BpmnModeler
  engine?: EngineId
  scenarios: unknown = []
  private simulating = false
  private readonly changeListeners: ChangeListener[] = []
  private readonly toggleListeners: Array<(active: boolean) => void> = []

  constructor(
    private readonly canvas: HTMLElement,
    private readonly propertiesPanel: HTMLElement,
  ) {}

  get dataSimulation(): DataSimulation {
    return this.modeler.get<DataSimulation>('dataSimulation')
  }

  async open({ xml, engine, scenarios = [] }: Model, { simulate = false } = {}): Promise<void> {
    this.leaveSimulation()
    this.createModeler(engine)
    await this.modeler.importXML(xml)
    this.scenarios = scenarios
    this.dataSimulation.setScenarios(scenarios)
    if (simulate) this.modeler.get<ToggleMode>('toggleMode').toggleMode(true)
    else this.fit()
  }

  setScenarios(scenarios: unknown): void {
    this.dataSimulation.setScenarios(scenarios)
    this.scenarios = scenarios
  }

  async save(): Promise<Model> {
    const { xml } = await this.modeler.saveXML({ format: true })
    return { xml: xml!, engine: this.engine!, scenarios: this.scenarios }
  }

  onChange(listener: ChangeListener): void {
    this.changeListeners.push(listener)
  }

  onToggleSimulation(listener: (active: boolean) => void): void {
    this.toggleListeners.push(listener)
  }

  fit(): void {
    const canvas = this.modeler.get<Canvas>('canvas')
    canvas.resized()
    const { inner, outer } = canvas.viewbox()
    const availableWidth = outer.width - PALETTE_SPACE - 2 * FIT_PADDING
    const availableHeight = outer.height - 2 * FIT_PADDING
    const scale = Math.max(
      MIN_SCALE_WITH_CONTEXT_PADS,
      Math.min(1, availableWidth / inner.width, availableHeight / inner.height),
    )
    canvas.viewbox({
      x: inner.x - (PALETTE_SPACE + FIT_PADDING + (availableWidth - inner.width * scale) / 2) / scale,
      y: inner.y - (FIT_PADDING + (availableHeight - inner.height * scale) / 2) / scale,
      width: outer.width / scale,
      height: outer.height / scale,
    })
  }

  private leaveSimulation(): void {
    if (this.simulating) this.modeler.get<ToggleMode>('toggleMode').toggleMode(false)
  }

  private createModeler(engine: EngineId): void {
    this.modeler?.destroy()
    const setup = ENGINE_SETUP[engine]
    this.engine = engine
    this.modeler = new BpmnModeler({
      container: this.canvas,
      propertiesPanel: { parent: this.propertiesPanel },
      additionalModules: [
        BpmnPropertiesPanelModule,
        BpmnPropertiesProviderModule,
        ...setup.modules,
        TokenSimulationModule,
        DataSimulationModule,
      ],
      moddleExtensions: setup.moddleExtensions,
      dataSimulation: { engine },
    })
    this.modeler.on('commandStack.changed', () => this.changeListeners.forEach(listener => listener()))
    this.modeler.on('tokenSimulation.toggleMode', (event: { active: boolean }) => {
      this.simulating = event.active
      this.toggleListeners.forEach(listener => listener(event.active))
    })
  }
}
