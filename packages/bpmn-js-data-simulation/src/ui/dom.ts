type Child = Node | string | null | undefined | false

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes: Record<string, string> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag)
  for (const [name, value] of Object.entries(attributes)) {
    if (name === 'className') element.className = value
    else element.setAttribute(name, value)
  }
  for (const child of children) {
    if (child) element.append(child)
  }
  return element
}

export function formatValue(value: unknown): string {
  if (value === undefined) return 'undefined'
  return JSON.stringify(value) ?? String(value)
}
