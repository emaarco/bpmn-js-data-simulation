import type { StartField, Variables } from '../domain/model.js'
import { StartFieldCodec } from '../domain/StartFieldCodec.js'
import { h } from '../utils/dom.js'
import type { FormValues, RenderedStartForm } from './startForm.js'

type FieldInput = HTMLInputElement | HTMLTextAreaElement

export class SimpleStartForm implements RenderedStartForm {
  private readonly codec = new StartFieldCodec()
  private readonly inputs = new Map<string, FieldInput>()
  private readonly form = h('div', { className: 'bds-form' })

  constructor(
    container: HTMLElement,
    private readonly fields: StartField[],
    values: Variables,
  ) {
    for (const field of fields) {
      const input = this.createInput(field)
      this.inputs.set(field.name, input)
      this.form.append(this.renderField(field, input))
    }
    for (const field of fields)
      this.writeInput(this.inputs.get(field.name)!, this.codec.format(field, values[field.name]))
    container.append(this.form)
  }

  readValues(): FormValues {
    const result: Record<string, unknown> = {}
    for (const field of this.fields) {
      const input = this.inputs.get(field.name)!
      const parsed = this.codec.parse(
        field,
        input.type === 'checkbox' ? (input as HTMLInputElement).checked : input.value,
      )
      if (!parsed.ok) return parsed
      result[field.name] = parsed.value
    }
    return { ok: true, values: result }
  }

  focus(): void {
    this.inputs.values().next().value?.focus()
  }

  destroy(): void {
    this.form.remove()
  }

  private renderField(field: StartField, input: FieldInput): HTMLElement {
    const id = `bds-field-${field.name}`
    input.id = id
    const hint = h('span', { className: 'bds-field-hint' }, `Used by ${field.usedBy.join(', ')}`)
    if (field.type === 'boolean') {
      return h(
        'div',
        { className: 'bds-field bds-field--checkbox' },
        h(
          'label',
          { className: 'bds-checkbox', for: id },
          input,
          h('span', { className: 'bds-field-name' }, field.name),
        ),
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

  private createInput(field: StartField): FieldInput {
    if (field.type === 'boolean') return h('input', { type: 'checkbox', name: field.name })
    if (field.type === 'json') {
      return h('textarea', { className: 'bds-input bds-json', name: field.name, rows: '2', spellcheck: 'false' })
    }
    const type = field.type === 'number' ? 'number' : 'text'
    return h('input', { className: 'bds-input', type, name: field.name, step: 'any', autocomplete: 'off' })
  }

  private writeInput(input: FieldInput, value: string | boolean): void {
    if (typeof value === 'boolean') (input as HTMLInputElement).checked = value
    else input.value = value
  }
}
