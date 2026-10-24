import componentStyles from '../styles/components.css?inline'
import { h } from './dom.js'

let sharedSheet: CSSStyleSheet | undefined

export function inShadow(...children: Node[]): HTMLElement {
  const host = h('div', { className: 'bds-host' })
  const root = host.attachShadow({ mode: 'open' })
  adoptComponentStyles(root)
  root.append(...children)
  return host
}

function adoptComponentStyles(root: ShadowRoot): void {
  if ('adoptedStyleSheets' in root && 'replaceSync' in CSSStyleSheet.prototype) {
    sharedSheet ??= createSheet()
    root.adoptedStyleSheets = [sharedSheet]
  } else {
    root.append(h('style', {}, componentStyles))
  }
}

function createSheet(): CSSStyleSheet {
  const sheet = new CSSStyleSheet()
  sheet.replaceSync(componentStyles)
  return sheet
}
