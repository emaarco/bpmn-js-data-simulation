import type { Variables } from './model.js'

export function setVariable(variables: Variables, path: string, value: unknown): Variables {
  const [head, ...rest] = path.split('.')
  if (!rest.length) {
    return { ...variables, [head]: value }
  }
  const nested = variables[head]
  const nestedVariables = isVariables(nested) ? nested : {}
  return { ...variables, [head]: setVariable(nestedVariables, rest.join('.'), value) }
}

export function isVariables(value: unknown): value is Variables {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
