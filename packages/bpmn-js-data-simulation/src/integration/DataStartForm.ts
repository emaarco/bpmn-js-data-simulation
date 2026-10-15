import type { Variables } from '../domain/model.js'
import { deriveStartFields, type ElementVariableUsage, type StartField } from '../domain/startFields.js'
import type { DataSimulationStore } from '../simulation/DataSimulationStore.js'
import { inShadow } from '../ui/shadow.js'
import { simpleStartFormRenderer } from '../ui/SimpleStartForm.js'
import { openStartDialog } from '../ui/StartDialog.js'
import type { StartFormRenderer } from '../ui/startForm.js'
import type { DataSimulation, DataSimulationConfig } from './DataSimulation.js'
import { type DiagramElement, elementName, type EventBus, is, TOGGLE_MODE_EVENT } from './tokenSimulation.js'

export class DataStartForm {
  static $inject = ['config.dataSimulation', 'eventBus', 'dataSimulation', 'dataSimulationStore']

  private readonly renderer: StartFormRenderer
  private dialogHost?: HTMLElement
  private closeDialog?: () => void

  constructor(
    config: DataSimulationConfig | undefined,
    eventBus: EventBus,
    private readonly dataSimulation: DataSimulation,
    private readonly store: DataSimulationStore,
  ) {
    this.renderer = config?.startFormRenderer ?? simpleStartFormRenderer
    eventBus.on(TOGGLE_MODE_EVENT, () => this.closeDialog?.())
    eventBus.on('diagram.destroy', () => {
      this.closeDialog?.()
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
    return deriveStartFields(this.collectUsages(startEvent.parent!), { examples, taskResultNames })
  }

  open(startEvent: DiagramElement, start: () => void): void {
    this.closeDialog?.()
    const snapshot = this.store.getSnapshot()
    this.dialogHost ??= document.body.appendChild(inShadow())
    const close = openStartDialog(this.dialogHost.shadowRoot!, {
      processName: elementName(startEvent.parent!),
      engineLabel: `${snapshot.engineLabel} · ${snapshot.expressionLanguage}`,
      scenarios: snapshot.scenarios,
      selectedScenarioId: snapshot.selectedScenarioId,
      startVariables: snapshot.startVariables,
      fieldsFor: scenarioId => this.fieldsFor(startEvent, scenarioId),
      renderer: this.renderer,
      onStart: (scenarioId, variables) => {
        this.closeDialog = undefined
        this.store.selectScenario(scenarioId)
        this.store.setStartVariables(variables)
        start()
      },
    })
    this.closeDialog = () => {
      close()
      this.closeDialog = undefined
    }
  }

  private collectUsages(container: DiagramElement): ElementVariableUsage[] {
    const engine = this.dataSimulation.getEngine()
    const usages: ElementVariableUsage[] = []
    const visit = (element: DiagramElement): void => {
      if (element.type === 'label') return
      const businessObject = element.businessObject
      if (is(element, 'bpmn:SequenceFlow')) {
        const condition = engine.readCondition(businessObject)
        if (condition) usages.push(usage(element, { conditionReads: engine.readVariableNames(condition) }))
      } else if (is(element, 'bpmn:FlowNode')) {
        const inputs = engine.readInputMappings(businessObject)
        const outputs = engine.readOutputMappings(businessObject)
        usages.push(
          usage(element, {
            inputReads: inputs.flatMap(mapping => engine.readVariableNames(mapping.source)),
            inputTargets: inputs.map(mapping => mapping.target),
            outputReads: outputs.flatMap(mapping => engine.readVariableNames(mapping.source)),
            outputTargets: outputs.map(mapping => mapping.target),
          }),
        )
      }
      element.children?.forEach(visit)
    }
    container.children?.forEach(visit)
    return usages
  }
}

function usage(element: DiagramElement, reads: Partial<ElementVariableUsage>): ElementVariableUsage {
  const target = is(element, 'bpmn:SequenceFlow') ? (element.source ?? element) : element
  return {
    elementName: elementName(target),
    conditionReads: [],
    inputReads: [],
    inputTargets: [],
    outputReads: [],
    outputTargets: [],
    ...reads,
  }
}
