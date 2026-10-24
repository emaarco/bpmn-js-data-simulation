import type { StartField, Variables } from '../domain/model.js'
import { SimpleStartForm } from './SimpleStartForm.js'
import type { RenderedStartForm, StartFormRenderer } from './startForm.js'

export class SimpleStartFormRenderer implements StartFormRenderer {
  render(container: HTMLElement, fields: StartField[], values: Variables): RenderedStartForm {
    return new SimpleStartForm(container, fields, values)
  }
}
