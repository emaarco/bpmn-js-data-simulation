import { formatFieldValue, parseFieldValue, type StartField } from '../domain/startFields.js'
import { h } from './dom.js'
import type { FormValues, StartFormRenderer } from './startForm.js'

type FieldInput = HTMLInputElement | HTMLTextAreaElement

export const simpleStartFormRenderer: StartFormRenderer = {
  render(container, fields, values) {
    const inputs = new Map<string, FieldInput>()
    const form = h('div', { className: 'bds-form' })
    for (const field of fields) {
      const input = createInput(field)
      inputs.set(field.name, input)
      form.append(renderField(field, input))
    }
    for (const field of fields) writeInput(inputs.get(field.name)!, formatFieldValue(field, values[field.name]))
    container.append(form)

    return {
      readValues(): FormValues {
        const result: Record<string, unknown> = {}
        for (const field of fields) {
          const input = inputs.get(field.name)!
          const parsed = parseFieldValue(
            field,
            input.type === 'checkbox' ? (input as HTMLInputElement).checked : input.value,
          )
          if (!parsed.ok) return parsed
          result[field.name] = parsed.value
        }
        return { ok: true, values: result }
      },
      focus() {
        inputs.values().next().value?.focus()
      },
      destroy() {
        form.remove()
      },
    }
  },
}

function renderField(field: StartField, input: FieldInput): HTMLElement {
  const id = `bds-field-${field.name}`
  input.id = id
  const hint = h('span', { className: 'bds-field-hint' }, `Used by ${field.usedBy.join(', ')}`)
  if (field.type === 'boolean') {
    return h(
      'div',
      { className: 'bds-field bds-field--checkbox' },
      h('label', { className: 'bds-checkbox', for: id }, input, h('span', { className: 'bds-field-name' }, field.name)),
      hint,
    )
  }
  return h(
    'div',
    { className: 'bds-field' },
    h('label', { className: 'bds-field-name', for: id }, field.name),
    input,
    hint,
  )
}

function createInput(field: StartField): FieldInput {
  if (field.type === 'boolean') return h('input', { type: 'checkbox', name: field.name })
  if (field.type === 'json') {
    return h('textarea', { className: 'bds-input bds-json', name: field.name, rows: '2', spellcheck: 'false' })
  }
  const type = field.type === 'number' ? 'number' : 'text'
  return h('input', { className: 'bds-input', type, name: field.name, step: 'any', autocomplete: 'off' })
}

function writeInput(input: FieldInput, value: string | boolean): void {
  if (typeof value === 'boolean') (input as HTMLInputElement).checked = value
  else input.value = value
}
