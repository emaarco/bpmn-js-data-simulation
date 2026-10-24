import type { Scenario, StartField, Variables } from '../domain/model.js'
import { StartFieldCodec } from '../domain/StartFieldCodec.js'
import { h } from '../utils/dom.js'
import type { RenderedStartForm, StartFormRenderer } from './startForm.js'

export interface StartDialogOptions {
  processName: string
  engineLabel: string
  scenarios: Scenario[]
  selectedScenarioId: string | null
  startVariables: Variables
  fieldsFor(scenarioId: string | null): StartField[]
  renderer: StartFormRenderer
  onStart(scenarioId: string | null, variables: Variables): void
}

const NO_SCENARIO = ''

export class StartDialog {
  private readonly codec = new StartFieldCodec()
  private readonly scenarioSelect = h('select', {
    className: 'bds-input bds-scenario-select',
    'aria-label': 'Scenario',
  })
  private readonly scenarioDescription = h('p', { className: 'bds-hint' })
  private readonly formContainer = h('div', { className: 'bds-dialog-form' })
  private readonly noFieldsHint = h('p', { className: 'bds-hint' }, 'The process reads no start variables.')
  private readonly error = h('p', { className: 'bds-error', role: 'alert' })
  private readonly cancelButton = h('button', { className: 'bds-button', type: 'button' }, 'Cancel')
  private readonly startButton = h(
    'button',
    { className: 'bds-button bds-button--primary', type: 'submit' },
    'Start instance',
  )
  private readonly form: HTMLFormElement
  private readonly backdrop: HTMLElement
  private baseVariables: Variables
  private fields: StartField[] = []
  private rendered: RenderedStartForm

  constructor(private readonly options: StartDialogOptions) {
    this.baseVariables = options.startVariables
    this.scenarioSelect.append(
      h('option', { value: NO_SCENARIO }, 'No scenario'),
      ...options.scenarios.map(scenario => h('option', { value: scenario.id }, scenario.name)),
    )
    this.scenarioSelect.value = options.selectedScenarioId ?? NO_SCENARIO
    this.error.hidden = true
    this.form = this.createForm()
    this.backdrop = h('div', { className: 'bds-dialog-backdrop' }, this.form)
    this.rendered = this.renderForm()
    this.listen()
  }

  open(container: ParentNode): void {
    this.showScenarioDescription()
    container.append(this.backdrop)
    if (this.fields.length) this.rendered.focus()
    else this.startButton.focus()
  }

  close(): void {
    this.rendered.destroy()
    this.backdrop.remove()
  }

  private createForm(): HTMLFormElement {
    const titleId = `bds-start-title-${Math.random().toString(36).slice(2)}`
    return h(
      'form',
      { className: 'bds-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId },
      h(
        'header',
        { className: 'bds-dialog-header' },
        h('h2', { className: 'bds-panel-title', id: titleId }, `Start “${this.options.processName}”`),
        h('span', { className: 'bds-engine' }, this.options.engineLabel),
      ),
      h(
        'div',
        { className: 'bds-dialog-content' },
        this.options.scenarios.length
          ? h(
              'section',
              { className: 'bds-section' },
              h('label', { className: 'bds-label' }, 'Scenario', this.scenarioSelect),
              this.scenarioDescription,
            )
          : null,
        h(
          'section',
          { className: 'bds-section' },
          h('h3', { className: 'bds-section-title' }, 'Start variables'),
          this.formContainer,
          this.noFieldsHint,
        ),
        this.error,
      ),
      h('footer', { className: 'bds-actions' }, this.cancelButton, this.startButton),
    )
  }

  private listen(): void {
    this.scenarioSelect.addEventListener('change', () => this.switchScenario())
    this.cancelButton.addEventListener('click', () => this.close())
    this.backdrop.addEventListener('mousedown', event => {
      if (event.target === this.backdrop) this.close()
    })
    this.backdrop.addEventListener('keydown', event => {
      event.stopPropagation()
      if (event.key === 'Escape') this.close()
    })
    this.form.addEventListener('submit', event => {
      event.preventDefault()
      this.submit()
    })
  }

  private selectedScenarioId(): string | null {
    return this.scenarioSelect.value || null
  }

  private selectedScenario(): Scenario | undefined {
    return this.options.scenarios.find(scenario => scenario.id === this.scenarioSelect.value)
  }

  private renderForm(): RenderedStartForm {
    this.fields = this.options.fieldsFor(this.selectedScenarioId())
    this.noFieldsHint.hidden = this.fields.length > 0
    return this.options.renderer.render(this.formContainer, this.fields, this.baseVariables)
  }

  private switchScenario(): void {
    this.baseVariables = this.selectedScenario()?.variables ?? {}
    this.rendered.destroy()
    this.rendered = this.renderForm()
    this.showScenarioDescription()
  }

  private showScenarioDescription(): void {
    const description = this.selectedScenario()?.description ?? ''
    this.scenarioDescription.textContent = description
    this.scenarioDescription.hidden = !description
  }

  private submit(): void {
    const values = this.rendered.readValues()
    if (!values.ok) {
      this.error.textContent = values.reason
      this.error.hidden = false
      return
    }
    this.close()
    this.options.onStart(this.selectedScenarioId(), this.codec.apply(this.baseVariables, values.values))
  }
}
