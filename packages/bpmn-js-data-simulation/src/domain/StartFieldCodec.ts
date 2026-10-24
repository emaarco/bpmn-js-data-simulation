import type { FieldValue, StartField, Variables } from './model.js'

export class StartFieldCodec {
  parse(field: StartField, raw: string | boolean): FieldValue {
    if (typeof raw === 'boolean') return { ok: true, value: raw }
    const text = raw.trim()
    if (!text) return { ok: true, value: undefined }
    switch (field.type) {
      case 'number': {
        const value = Number(text)
        return Number.isNaN(value) ? { ok: false, reason: `${field.name} must be a number` } : { ok: true, value }
      }
      case 'json':
        try {
          return { ok: true, value: JSON.parse(text) }
        } catch {
          return { ok: false, reason: `${field.name} must be valid JSON` }
        }
      case 'auto':
        try {
          return { ok: true, value: JSON.parse(text) }
        } catch {
          return { ok: true, value: raw }
        }
      default:
        return { ok: true, value: raw }
    }
  }

  format(field: StartField, value: unknown): string | boolean {
    if (field.type === 'boolean') return value === true
    if (value === undefined || value === null) return ''
    if (typeof value === 'string' && field.type !== 'json') return value
    return field.type === 'number' ? String(value) : JSON.stringify(value)
  }

  apply(base: Variables, values: Record<string, unknown>): Variables {
    const variables = { ...base }
    for (const [name, value] of Object.entries(values)) {
      if (value === undefined) delete variables[name]
      else variables[name] = value
    }
    return variables
  }
}
