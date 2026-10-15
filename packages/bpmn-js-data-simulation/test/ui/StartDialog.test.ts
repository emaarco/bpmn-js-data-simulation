// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import type { StartField } from '../../src/domain/startFields'
import { simpleStartFormRenderer } from '../../src/ui/SimpleStartForm'
import { openStartDialog, type StartDialogOptions } from '../../src/ui/StartDialog'

const fields: StartField[] = [
  { name: 'orderTotal', type: 'number', usedBy: ['Credit OK?'] },
  { name: 'insurance', type: 'boolean', usedBy: ['Extras?'] },
  { name: 'accessories', type: 'json', usedBy: ['Extras?'] },
]

function open(overrides: Partial<StartDialogOptions> = {}) {
  const container = document.createElement('div')
  document.body.append(container)
  const onStart = vi.fn()
  openStartDialog(container, {
    processName: 'Bike order',
    engineLabel: 'Zeebe · FEEL',
    scenarios: [
      {
        id: 'small',
        name: 'Small order',
        description: 'A city bike',
        variables: { orderTotal: 1290, insurance: true, bikeId: 'MV-1' },
        taskResults: {},
      },
      { id: 'large', name: 'Large order', variables: { orderTotal: 8900, insurance: false }, taskResults: {} },
    ],
    selectedScenarioId: 'small',
    startVariables: { orderTotal: 1290, insurance: true, bikeId: 'MV-1' },
    fieldsFor: () => fields,
    renderer: simpleStartFormRenderer,
    onStart,
    ...overrides,
  })
  const query = <T extends Element>(selector: string) => container.querySelector<T>(selector)!
  const submit = () => query<HTMLFormElement>('.bds-dialog').requestSubmit()
  return { container, onStart, query, submit }
}

describe('start dialog', () => {
  it('prefills the fields from the start variables', () => {
    const { query } = open()

    expect(query('.bds-dialog-header').textContent).toContain('Start “Bike order”')
    expect(query<HTMLInputElement>('[name="orderTotal"]').value).toBe('1290')
    expect(query<HTMLInputElement>('[name="insurance"]').checked).toBe(true)
    expect(query('.bds-dialog').textContent).toContain('Used by Credit OK?')
  })

  it('starts with the scenario variables plus the edited fields', () => {
    const { onStart, query, submit } = open()
    query<HTMLInputElement>('[name="orderTotal"]').value = '42'
    query<HTMLTextAreaElement>('[name="accessories"]').value = '["lock"]'
    submit()

    expect(onStart).toHaveBeenCalledWith('small', {
      orderTotal: 42,
      insurance: true,
      bikeId: 'MV-1',
      accessories: ['lock'],
    })
  })

  it('switches the fields to another scenario', () => {
    const { onStart, query, submit } = open()
    const select = query<HTMLSelectElement>('.bds-scenario-select')
    select.value = 'large'
    select.dispatchEvent(new Event('change'))

    expect(query<HTMLInputElement>('[name="orderTotal"]').value).toBe('8900')
    submit()
    expect(onStart).toHaveBeenCalledWith('large', { orderTotal: 8900, insurance: false })
  })

  it('asks for what the scenario no longer provides when the scenario changes', () => {
    const { query } = open({
      fieldsFor: scenarioId =>
        scenarioId ? fields : [...fields, { name: 'score', type: 'number', usedBy: ['Check'] }],
    })
    const select = query<HTMLSelectElement>('.bds-scenario-select')
    expect(query('[name="score"]')).toBeNull()

    select.value = ''
    select.dispatchEvent(new Event('change'))
    expect(query('[name="score"]')).not.toBeNull()
  })

  it('starts without a scenario and leaves emptied fields out', () => {
    const { onStart, query, submit } = open()
    const select = query<HTMLSelectElement>('.bds-scenario-select')
    select.value = ''
    select.dispatchEvent(new Event('change'))
    query<HTMLInputElement>('[name="orderTotal"]').value = '10'
    submit()

    expect(onStart).toHaveBeenCalledWith(null, { orderTotal: 10, insurance: false })
  })

  it('shows invalid values instead of starting', () => {
    const { onStart, query, submit } = open()
    query<HTMLTextAreaElement>('[name="accessories"]').value = '['
    submit()

    expect(onStart).not.toHaveBeenCalled()
    expect(query('.bds-error').textContent).toBe('accessories must be valid JSON')
  })

  it('closes on Escape without starting', () => {
    const { container, onStart, query } = open()
    query('.bds-dialog').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))

    expect(container.querySelector('.bds-dialog')).toBeNull()
    expect(onStart).not.toHaveBeenCalled()
  })
})
