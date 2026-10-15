// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import type { InstanceState, SimulationSnapshot } from '../../src/simulation/DataSimulationStore'
import { VariablesPanel } from '../../src/ui/VariablesPanel'

function snapshot(overrides: Partial<SimulationSnapshot> = {}): SimulationSnapshot {
  return {
    engineLabel: 'Zeebe',
    expressionLanguage: 'FEEL',
    scenarios: [
      { id: 'a', name: 'Scenario A', description: 'First', variables: { total: 1 }, taskResults: {} },
      { id: 'b', name: 'Scenario B', variables: {}, taskResults: {} },
    ],
    selectedScenarioId: 'a',
    startVariables: { total: 1 },
    instances: [],
    selectedInstanceId: null,
    log: [],
    ...overrides,
  }
}

function instance(id: string, overrides: Partial<InstanceState> = {}): InstanceState {
  return {
    id,
    number: 1,
    processName: 'Order',
    scenarioId: 'a',
    status: 'running',
    variables: {},
    waiting: [],
    ...overrides,
  }
}

function createPanel() {
  const actions = {
    selectInstance: vi.fn(),
    setInstanceVariables: vi.fn(),
  }
  const panel = new VariablesPanel(actions)
  document.body.append(panel.element)
  return { panel, actions, query: <T extends Element>(selector: string) => panel.element.querySelector<T>(selector)! }
}

function type(element: HTMLTextAreaElement, value: string): void {
  element.value = value
  element.dispatchEvent(new Event('input'))
}

describe('VariablesPanel', () => {
  it('shows the engine and a hint how to start', () => {
    const { panel, query } = createPanel()
    panel.render(snapshot())

    expect(query('.bds-engine').textContent).toBe('Zeebe · FEEL')
    expect(query('.bds-instance-body').textContent).toContain('Press ▶ on a start event')
  })

  it('edits the variables of the running instance', () => {
    const { panel, actions, query } = createPanel()
    panel.render(snapshot({ instances: [instance('i1', { variables: { total: 1 } })], selectedInstanceId: 'i1' }))
    expect(query('.bds-variables').textContent).toContain('total')

    query<HTMLButtonElement>('.bds-instance .bds-button').click()
    type(query<HTMLTextAreaElement>('.bds-instance-editor'), '[')
    query<HTMLButtonElement>('.bds-button--primary').click()
    expect(query('.bds-instance-editor').classList).toContain('bds-input--invalid')

    type(query<HTMLTextAreaElement>('.bds-instance-editor'), '{ "total": 99 }')
    query<HTMLButtonElement>('.bds-button--primary').click()

    expect(actions.setInstanceVariables).toHaveBeenCalledWith('i1', { total: 99 })
  })

  it('lists the mapping issues of the shown instance and hides the section without any', () => {
    const { panel, query } = createPanel()
    const issue = (id: number, instanceId: string) => ({
      id,
      kind: 'mapping-issue' as const,
      instanceId,
      elementId: 'Task',
      elementName: 'Check credit',
      target: 'score',
      reason: 'Variable not found',
    })
    panel.render(snapshot({ instances: [instance('i1')], selectedInstanceId: 'i1', log: [issue(1, 'i2')] }))
    expect(query<HTMLElement>('.bds-issues').hidden).toBe(true)

    panel.render(snapshot({ instances: [instance('i1')], selectedInstanceId: 'i1', log: [issue(2, 'i1')] }))
    expect(query<HTMLElement>('.bds-issues').hidden).toBe(false)
    expect(query('.bds-issues').textContent).toContain('score: Variable not found')
  })

  it('shows the selected instance and lets the user pick another one', () => {
    const { panel, actions, query } = createPanel()
    panel.render(
      snapshot({
        instances: [
          instance('i1', { status: 'completed' }),
          instance('i2', {
            number: 2,
            status: 'waiting',
            waiting: [{ scopeId: 's', gatewayId: 'G', gatewayName: 'Credit OK?' }],
          }),
        ],
        selectedInstanceId: 'i2',
      }),
    )
    const picker = query<HTMLSelectElement>('.bds-instance-select')

    expect(picker.value).toBe('i2')
    expect(picker.textContent).toContain('#2 Scenario A (waiting)')
    expect(query('.bds-status').textContent).toBe('Order · waiting at Credit OK?')
    expect(query('.bds-instance-body').textContent).toContain('Scenario: Scenario A')

    picker.value = 'i1'
    picker.dispatchEvent(new Event('change'))
    expect(actions.selectInstance).toHaveBeenCalledWith('i1')
  })

  it('keeps the edited instance selected when another instance starts', () => {
    const { panel, actions, query } = createPanel()
    panel.render(snapshot({ instances: [instance('i1')], selectedInstanceId: 'i1' }))
    query<HTMLButtonElement>('.bds-instance .bds-button').click()
    panel.render(snapshot({ instances: [instance('i1'), instance('i2', { number: 2 })], selectedInstanceId: 'i2' }))

    expect(actions.selectInstance).toHaveBeenCalledWith('i1')
  })

  it('stays closed until its palette entry opens it, like the simulation log', () => {
    const { panel, query } = createPanel()
    panel.render(snapshot())
    expect(panel.element.hidden).toBe(true)

    panel.paletteEntry.click()
    expect(panel.element.hidden).toBe(false)
    expect(panel.paletteEntry.classList).toContain('active')

    query<HTMLButtonElement>('.bds-panel-close').click()
    expect(panel.element.hidden).toBe(true)
    expect(panel.paletteEntry.classList).not.toContain('active')
  })
})
