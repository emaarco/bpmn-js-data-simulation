import type { Variables } from '../domain/model.js'
import { isVariables } from '../domain/variables.js'
import type { InstanceState, MappingIssueLogEntry, SimulationSnapshot } from '../simulation/DataSimulationStore.js'
import { formatValue, h } from './dom.js'

export interface VariablesPanelActions {
  selectInstance(instanceId: string): void
  setInstanceVariables(instanceId: string, variables: Variables): void
}

const VARIABLES_ICON =
  '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.5 2.5C4 2.5 4 3.5 4 5v1c0 1-.8 2-2 2 1.2 0 2 1 2 2v1c0 1.5 0 2.5 1.5 2.5M10.5 2.5c1.5 0 1.5 1 1.5 2.5v1c0 1 .8 2 2 2-1.2 0-2 1-2 2v1c0 1.5 0 2.5-1.5 2.5" /></svg>'
const CLOSE_ICON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" /></svg>'

export class VariablesPanel {
  readonly element: HTMLElement
  readonly paletteEntry = h('button', {
    className: 'bts-entry bds-palette-entry',
    type: 'button',
    title: 'Toggle Process Data',
    'aria-label': 'Toggle Process Data',
  })

  private readonly engineBadge = h('span', { className: 'bds-engine' })
  private readonly closeButton = h('button', { className: 'bds-panel-close', type: 'button', 'aria-label': 'Close' })
  private readonly instanceTitle = h('h3', { className: 'bds-section-title' }, 'Instance')
  private readonly instancePicker = h('select', {
    className: 'bds-input bds-instance-select',
    'aria-label': 'Process instance',
  })
  private readonly instanceBody = h('div', { className: 'bds-instance-body' })
  private readonly issueList = h('ol', { className: 'bds-log' })
  private readonly issueSection = h(
    'section',
    { className: 'bds-section bds-issues' },
    h('h3', { className: 'bds-section-title' }, 'Issues'),
    this.issueList,
  )

  private snapshot?: SimulationSnapshot
  private editingInstanceId?: string
  private shownInstances = ''

  constructor(private readonly actions: VariablesPanelActions) {
    this.paletteEntry.innerHTML = `<span class="bts-icon bds-variables-icon">${VARIABLES_ICON}</span>`
    this.closeButton.innerHTML = CLOSE_ICON
    const icon = h('span', { className: 'bds-variables-icon' })
    icon.innerHTML = VARIABLES_ICON
    this.element = h(
      'aside',
      { className: 'bds-panel', 'aria-label': 'Process Data' },
      h(
        'header',
        { className: 'bds-panel-header' },
        icon,
        h('h2', { className: 'bds-panel-heading' }, 'Process Data'),
        this.closeButton,
      ),
      h(
        'div',
        { className: 'bds-panel-body' },
        h('p', { className: 'bds-panel-engine' }, this.engineBadge),
        h('section', { className: 'bds-section bds-instance' }, this.instanceTitle, this.instanceBody),
        this.issueSection,
      ),
    )

    this.paletteEntry.addEventListener('click', () => this.toggle())
    this.closeButton.addEventListener('click', () => this.toggle(false))
    this.instancePicker.addEventListener('change', () => this.actions.selectInstance(this.instancePicker.value))
    this.toggle(false)
  }

  toggle(shown = this.element.hidden === true): void {
    this.element.hidden = !shown
    this.paletteEntry.classList.toggle('active', shown)
  }

  render(snapshot: SimulationSnapshot): void {
    this.snapshot = snapshot
    this.engineBadge.textContent = `${snapshot.engineLabel} · ${snapshot.expressionLanguage}`
    this.renderInstance(snapshot)
    this.renderIssues(snapshot)
  }

  private renderInstance({ instances, selectedInstanceId, scenarios }: SimulationSnapshot): void {
    const editedInstance = instances.find(candidate => candidate.id === this.editingInstanceId)
    if (editedInstance && editedInstance.status !== 'completed' && editedInstance.id !== selectedInstanceId) {
      this.actions.selectInstance(editedInstance.id)
      return
    }
    const instance = instances.find(candidate => candidate.id === selectedInstanceId)
    this.renderInstancePicker(instances, selectedInstanceId, scenarios)
    if (this.editingInstanceId && this.editingInstanceId === instance?.id && instance.status !== 'completed') return
    this.editingInstanceId = undefined
    this.instanceBody.replaceChildren(
      instance
        ? this.instanceView(instance)
        : h('p', { className: 'bds-hint' }, 'Press ▶ on a start event to start a process instance.'),
    )
  }

  private renderInstancePicker(
    instances: InstanceState[],
    selectedInstanceId: string | null,
    scenarios: SimulationSnapshot['scenarios'],
  ): void {
    const signature = JSON.stringify(instances.map(instance => [instance.id, instance.status]))
    if (signature !== this.shownInstances) {
      this.shownInstances = signature
      this.instancePicker.replaceChildren(
        ...instances.map(instance => {
          const scenarioName = scenarios.find(scenario => scenario.id === instance.scenarioId)?.name ?? 'no scenario'
          return h('option', { value: instance.id }, `#${instance.number} ${scenarioName} (${instance.status})`)
        }),
      )
    }
    this.instancePicker.value = selectedInstanceId ?? ''
    this.instancePicker.hidden = instances.length < 2
    if (!this.instancePicker.isConnected) this.instanceTitle.after(this.instancePicker)
  }

  private instanceView(instance: InstanceState): HTMLElement {
    const scenarioName = this.snapshot?.scenarios.find(scenario => scenario.id === instance.scenarioId)?.name
    const entries = Object.entries(instance.variables)
    const editButton = h('button', { className: 'bds-button', type: 'button' }, 'Edit')
    editButton.addEventListener('click', () => this.editInstance(instance))
    return h(
      'div',
      {},
      h('p', { className: `bds-status bds-status--${instance.status}` }, describeStatus(instance)),
      scenarioName ? h('p', { className: 'bds-hint' }, `Scenario: ${scenarioName}`) : null,
      entries.length
        ? h(
            'table',
            { className: 'bds-variables' },
            h(
              'tbody',
              {},
              ...entries.map(([name, value]) =>
                h('tr', {}, h('th', { scope: 'row' }, name), h('td', {}, h('code', {}, formatValue(value)))),
              ),
            ),
          )
        : h('p', { className: 'bds-hint' }, 'No variables yet.'),
      h('p', { className: 'bds-hint' }, 'Hover a gateway to see why it took its flow, click it to keep the card open.'),
      instance.status !== 'completed' ? h('div', { className: 'bds-actions' }, editButton) : null,
    )
  }

  private editInstance(instance: InstanceState): void {
    this.editingInstanceId = instance.id
    const editor = h('textarea', {
      className: 'bds-input bds-json bds-instance-editor',
      spellcheck: 'false',
      rows: '8',
      'aria-label': 'Instance variables (JSON)',
    })
    editor.value = JSON.stringify(instance.variables, null, 2)
    const error = h('p', { className: 'bds-error', role: 'alert' })
    showError(error, editor, '')
    const applyButton = h('button', { className: 'bds-button bds-button--primary', type: 'button' }, 'Apply')
    const cancelButton = h('button', { className: 'bds-button', type: 'button' }, 'Cancel')

    applyButton.addEventListener('click', () => {
      const parsed = parseVariables(editor.value)
      if (typeof parsed === 'string') {
        showError(error, editor, parsed)
        return
      }
      this.editingInstanceId = undefined
      this.actions.setInstanceVariables(instance.id, parsed)
    })
    cancelButton.addEventListener('click', () => {
      this.editingInstanceId = undefined
      if (this.snapshot) this.renderInstance(this.snapshot)
    })

    this.instanceBody.replaceChildren(editor, error, h('div', { className: 'bds-actions' }, cancelButton, applyButton))
    editor.focus()
  }

  private renderIssues({ log, selectedInstanceId }: SimulationSnapshot): void {
    const issues = log.filter(
      (entry): entry is MappingIssueLogEntry =>
        entry.kind === 'mapping-issue' && entry.instanceId === selectedInstanceId,
    )
    this.issueSection.hidden = !issues.length
    this.issueList.replaceChildren(...issues.slice().reverse().map(renderMappingIssue))
  }
}

function describeStatus({ processName, status, waiting }: InstanceState): string {
  if (status !== 'waiting') return `${processName} · ${status}`
  return `${processName} · waiting at ${waiting.map(gateway => gateway.gatewayName).join(', ')}`
}

function showError(error: HTMLElement, input: HTMLElement, message: string): void {
  error.textContent = message
  error.hidden = !message
  input.classList.toggle('bds-input--invalid', Boolean(message))
}

function renderMappingIssue({ elementName, target, reason }: MappingIssueLogEntry): HTMLElement {
  return h(
    'li',
    { className: 'bds-log-entry bds-log-entry--issue' },
    h('div', { className: 'bds-log-title' }, elementName, h('span', { className: 'bds-tag' }, 'mapping')),
    h('p', { className: 'bds-error' }, `${target}: ${reason}`),
  )
}

function parseVariables(text: string): Variables | string {
  try {
    const value: unknown = JSON.parse(text || '{}')
    return isVariables(value) ? value : 'Variables must be a JSON object'
  } catch (error) {
    return `Invalid JSON: ${(error as Error).message}`
  }
}
