import type { Variables } from '../domain/model.js'
import type { Scenario } from '../domain/scenario.js'
import { applyFieldValues, type StartField } from '../domain/startFields.js'
import { h } from './dom.js'
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

export function openStartDialog(container: ParentNode, options: StartDialogOptions): () => void {
  const { scenarios, renderer } = options
  let baseVariables = options.startVariables

  const scenarioSelect = h('select', { className: 'bds-input bds-scenario-select', 'aria-label': 'Scenario' })
  scenarioSelect.append(
    h('option', { value: NO_SCENARIO }, 'No scenario'),
    ...scenarios.map(scenario => h('option', { value: scenario.id }, scenario.name)),
  )
  scenarioSelect.value = options.selectedScenarioId ?? NO_SCENARIO
  const scenarioDescription = h('p', { className: 'bds-hint' })
  const formContainer = h('div', { className: 'bds-dialog-form' })
  const noFieldsHint = h('p', { className: 'bds-hint' }, 'The process reads no start variables.')
  const error = h('p', { className: 'bds-error', role: 'alert' })
  error.hidden = true
  const cancelButton = h('button', { className: 'bds-button', type: 'button' }, 'Cancel')
  const startButton = h('button', { className: 'bds-button bds-button--primary', type: 'submit' }, 'Start instance')
  const titleId = `bds-start-title-${Math.random().toString(36).slice(2)}`

  const form = h(
    'form',
    { className: 'bds-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId },
    h(
      'header',
      { className: 'bds-dialog-header' },
      h('h2', { className: 'bds-panel-title', id: titleId }, `Start “${options.processName}”`),
      h('span', { className: 'bds-engine' }, options.engineLabel),
    ),
    h(
      'div',
      { className: 'bds-dialog-content' },
      scenarios.length
        ? h(
            'section',
            { className: 'bds-section' },
            h('label', { className: 'bds-label' }, 'Scenario', scenarioSelect),
            scenarioDescription,
          )
        : null,
      h(
        'section',
        { className: 'bds-section' },
        h('h3', { className: 'bds-section-title' }, 'Start variables'),
        formContainer,
        noFieldsHint,
      ),
      error,
    ),
    h('footer', { className: 'bds-actions' }, cancelButton, startButton),
  )
  const backdrop = h('div', { className: 'bds-dialog-backdrop' }, form)
  const selectedScenarioId = (): string | null => scenarioSelect.value || null
  let fields: StartField[] = []
  const renderForm = (): RenderedStartForm => {
    fields = options.fieldsFor(selectedScenarioId())
    noFieldsHint.hidden = fields.length > 0
    return renderer.render(formContainer, fields, baseVariables)
  }
  let rendered = renderForm()

  const close = (): void => {
    rendered.destroy()
    backdrop.remove()
  }

  const showScenarioDescription = (): void => {
    const description = scenarios.find(scenario => scenario.id === scenarioSelect.value)?.description ?? ''
    scenarioDescription.textContent = description
    scenarioDescription.hidden = !description
  }

  scenarioSelect.addEventListener('change', () => {
    baseVariables = scenarios.find(scenario => scenario.id === scenarioSelect.value)?.variables ?? {}
    rendered.destroy()
    rendered = renderForm()
    showScenarioDescription()
  })
  cancelButton.addEventListener('click', close)
  backdrop.addEventListener('mousedown', event => {
    if (event.target === backdrop) close()
  })
  backdrop.addEventListener('keydown', event => {
    event.stopPropagation()
    if (event.key === 'Escape') close()
  })
  form.addEventListener('submit', event => {
    event.preventDefault()
    const values = rendered.readValues()
    if (!values.ok) {
      error.textContent = values.reason
      error.hidden = false
      return
    }
    close()
    options.onStart(selectedScenarioId(), applyFieldValues(baseVariables, values.values))
  })

  showScenarioDescription()
  container.append(backdrop)
  if (fields.length) rendered.focus()
  else startButton.focus()
  return close
}
