import type { StartField, Variables } from '../domain/model.js'
import { StartFieldDeriver } from '../domain/StartFieldDeriver.js'
import type { DataSimulationStore } from '../simulation/DataSimulationStore.js'
import { SimpleStartFormRenderer } from '../ui/SimpleStartFormRenderer.js'
import { StartDialog } from '../ui/StartDialog.js'
import type { StartFormRenderer } from '../ui/startForm.js'
import { elementName, is } from '../utils/diagramElements.js'
import { inShadow } from '../utils/shadow.js'
import type { DataSimulation, DataSimulationConfig } from './DataSimulation.js'
import { type DiagramElement, type EventBus, TOGGLE_MODE_EVENT } from './tokenSimulation.js'
import { VariableUsageCollector } from './VariableUsageCollector.js'

export class DataStartForm {
  static $inject = ['config.dataSimulation', 'eventBus', 'dataSimulation', 'dataSimulationStore']

  private readonly renderer: StartFormRenderer
  private readonly fieldDeriver = new StartFieldDeriver()
  private readonly usageCollector: VariableUsageCollector
  private dialogHost?: HTMLElement
  private dialog?: StartDialog

  constructor(
    config: DataSimulationConfig | undefined,
    eventBus: EventBus,
    dataSimulation: DataSimulation,
    private readonly store: DataSimulationStore,
  ) {
    this.renderer = config?.startFormRenderer ?? new SimpleStartFormRenderer()
    this.usageCollector = new VariableUsageCollector(dataSimulation.getEngine())
    eventBus.on(TOGGLE_MODE_EVENT, () => this.closeDialog())
    eventBus.on('diagram.destroy', () => {
      this.closeDialog()
      this.dialogHost?.remove()
    })
  }

  isProcessStart(element: DiagramElement): boolean {
    return (
      is(element, 'bpmn:StartEvent') &&
      Boolean(element.parent) &&
      (is(element.parent!, 'bpmn:Process') || is(element.parent!, 'bpmn:Participant'))
    )
  }

  fieldsFor(startEvent: DiagramElement, scenarioId: string | null): StartField[] {
    const snapshot = this.store.getSnapshot()
    const examples: Variables[] = [snapshot.startVariables, ...snapshot.scenarios.map(scenario => scenario.variables)]
    const taskResults = snapshot.scenarios.find(scenario => scenario.id === scenarioId)?.taskResults ?? {}
    const taskResultNames = Object.values(taskResults).flatMap(result => Object.keys(result))
    return this.fieldDeriver.derive(this.usageCollector.collect(startEvent.parent!), { examples, taskResultNames })
  }

  open(startEvent: DiagramElement, start: () => void): void {
    this.closeDialog()
    const snapshot = this.store.getSnapshot()
    this.dialogHost ??= document.body.appendChild(inShadow())
    this.dialog = new StartDialog({
      processName: elementName(startEvent.parent!),
      engineLabel: `${snapshot.engineLabel} · ${snapshot.expressionLanguage}`,
      scenarios: snapshot.scenarios,
      selectedScenarioId: snapshot.selectedScenarioId,
      startVariables: snapshot.startVariables,
      fieldsFor: scenarioId => this.fieldsFor(startEvent, scenarioId),
      renderer: this.renderer,
      onStart: (scenarioId, variables) => {
        this.dialog = undefined
        this.store.selectScenario(scenarioId)
        this.store.setStartVariables(variables)
        start()
      },
    })
    this.dialog.open(this.dialogHost.shadowRoot!)
  }

  private closeDialog(): void {
    this.dialog?.close()
    this.dialog = undefined
  }
}
