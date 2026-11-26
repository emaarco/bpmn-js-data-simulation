import { type PathResolution, type StartField, StartFieldCodec, type Variables } from '@emaarco/bpmn-js-data-simulation'
import type { Editor } from './Editor'
import { type ElementRegistry, type WhatIfField, WhatIfFields } from './WhatIfFields'

const NO_SCENARIO = ''

export class WhatIfPanel {
  private readonly codec = new StartFieldCodec()
  private readonly scenarioSelect = document.createElement('select')
  private readonly fieldList = document.createElement('div')
  private readonly decisionList = document.createElement('ul')
  private values: Variables = {}
  private chosenScenarioId: string | null = null
  private active = false

  constructor(
    private readonly panel: HTMLElement,
    private readonly toggle: HTMLButtonElement,
    private readonly editor: Editor,
  ) {
    this.buildPanel()
    toggle.addEventListener('click', () => this.setActive(!this.active))
    this.scenarioSelect.addEventListener('change', () => {
      this.chosenScenarioId = this.scenarioSelect.value
      this.prefill()
    })
    editor.onToggleSimulation(simulating => {
      if (simulating) this.setActive(false)
    })
    editor.onChange(() => {
      if (this.active) this.render()
    })
  }

  isActive(): boolean {
    return this.active
  }

  reload(): void {
    this.chosenScenarioId = null
    if (this.active) this.prefill()
  }

  private setActive(active: boolean): void {
    this.active = active
    this.panel.hidden = !active
    document.body.classList.toggle('is-whatif', active)
    this.toggle.setAttribute('aria-pressed', String(active))
    if (active) {
      this.editor.leaveSimulation()
      this.prefill()
    } else {
      this.editor.dataSimulation.clearResolution()
    }
    this.editor.fit()
  }

  private buildPanel(): void {
    const title = Object.assign(document.createElement('h2'), { textContent: 'What-if' })
    const hint = Object.assign(document.createElement('p'), {
      className: 'app-whatif-hint',
      textContent: 'Die Variablen entscheiden die Gateways sofort – ohne Token, ohne Instanz.',
    })
    const scenarioLabel = document.createElement('label')
    scenarioLabel.className = 'app-whatif-scenario'
    scenarioLabel.append(
      Object.assign(document.createElement('span'), { textContent: 'Vorbelegen aus' }),
      this.scenarioSelect,
    )
    this.scenarioSelect.dataset.testid = 'whatif-scenario'
    this.fieldList.className = 'app-whatif-fields'
    const pathTitle = Object.assign(document.createElement('h3'), { textContent: 'Pfad' })
    this.decisionList.className = 'app-whatif-decisions'
    this.decisionList.dataset.testid = 'whatif-decisions'
    this.panel.append(title, hint, scenarioLabel, this.fieldList, pathTitle, this.decisionList)
  }

  private prefill(): void {
    const { scenarios, selectedScenarioId } = this.editor.dataSimulation.getSnapshot()
    const options = scenarios.length ? scenarios : [{ id: NO_SCENARIO, name: 'Kein Szenario' }]
    this.scenarioSelect.replaceChildren(
      ...options.map(({ id, name }) =>
        Object.assign(document.createElement('option'), { value: id, textContent: name }),
      ),
    )
    const chosenId = this.chosenScenarioId ?? selectedScenarioId
    this.scenarioSelect.value = options.some(option => option.id === chosenId) ? chosenId! : options[0].id
    const scenario = scenarios.find(candidate => candidate.id === this.scenarioSelect.value)
    this.values = this.fields().prefill(scenario, scenarios)
    this.render()
  }

  private render(): void {
    this.fieldList.replaceChildren(
      ...this.fields()
        .derive(this.values)
        .map(field => this.renderField(field)),
    )
    this.resolve()
  }

  private resolve(): void {
    this.showDecisions(this.editor.dataSimulation.resolve(this.values))
  }

  private renderField(field: WhatIfField): HTMLElement {
    const row = document.createElement('label')
    row.className = `app-whatif-field app-whatif-field--${field.control.kind}`
    const name = Object.assign(document.createElement('span'), {
      className: 'app-whatif-name',
      textContent: field.name,
    })
    row.append(name, ...this.inputsFor(field))
    return row
  }

  private inputsFor(field: WhatIfField): HTMLInputElement[] {
    const { control, name } = field
    const current = this.values[name]
    if (control.kind === 'boolean') {
      const toggle = this.input(name, { type: 'checkbox', role: 'switch', checked: current === true })
      toggle.addEventListener('change', () => this.update(name, toggle.checked))
      return [toggle]
    }
    if (control.kind === 'number') {
      const range = { min: String(control.min), max: String(control.max), step: String(control.step) }
      const slider = this.input(`${name}-slider`, { type: 'range', ...range, value: String(current) })
      const exact = this.input(name, { type: 'number', step: 'any', value: String(current) })
      slider.addEventListener('input', () => {
        exact.value = slider.value
        this.update(name, slider.valueAsNumber)
      })
      exact.addEventListener('input', () => {
        if (Number.isNaN(exact.valueAsNumber)) return
        slider.value = exact.value
        this.update(name, exact.valueAsNumber)
      })
      return [exact, slider]
    }
    const startField: StartField = { name, type: control.kind === 'json' ? 'json' : 'auto', usedBy: [] }
    const text = this.input(name, { type: 'text', value: String(this.codec.format(startField, current)) })
    text.addEventListener('input', () => {
      const parsed = this.codec.parse(startField, text.value)
      text.classList.toggle('is-invalid', !parsed.ok)
      if (parsed.ok) this.update(name, parsed.value)
    })
    return [text]
  }

  private input(name: string, attributes: Record<string, string | boolean>): HTMLInputElement {
    const input = document.createElement('input')
    input.name = name
    Object.assign(input, attributes)
    return input
  }

  private update(name: string, value: unknown): void {
    this.values = this.codec.apply(this.values, { [name]: value })
    this.resolve()
  }

  private showDecisions({ decisions }: PathResolution): void {
    const registry = this.elementRegistry()
    const label = (id: string) => {
      const name = registry.get(id)?.businessObject.name
      return typeof name === 'string' && name.trim() ? name.trim() : id
    }
    this.decisionList.replaceChildren(
      ...Object.entries(decisions).map(([gatewayId, decision]) => {
        const item = document.createElement('li')
        item.classList.toggle('is-stuck', Boolean(decision.stuckReason))
        const outcome = decision.stuckReason ?? decision.takenFlowIds.map(label).join(', ')
        item.append(
          Object.assign(document.createElement('span'), {
            className: 'app-whatif-gateway',
            textContent: label(gatewayId),
          }),
          Object.assign(document.createElement('span'), { className: 'app-whatif-outcome', textContent: outcome }),
        )
        return item
      }),
    )
  }

  private fields(): WhatIfFields {
    return new WhatIfFields(this.elementRegistry(), this.editor.dataSimulation.getEngine())
  }

  private elementRegistry(): ElementRegistry {
    return this.editor.modeler.get<ElementRegistry>('elementRegistry')
  }
}
