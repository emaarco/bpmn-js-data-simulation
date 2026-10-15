import type { Variables } from '../domain/model.js'
import type { StartField } from '../domain/startFields.js'

export type FormValues = { ok: true; values: Record<string, unknown> } | { ok: false; reason: string }

export interface RenderedStartForm {
  readValues(): FormValues
  focus(): void
  destroy(): void
}

export interface StartFormRenderer {
  render(container: HTMLElement, fields: StartField[], values: Variables): RenderedStartForm
}
