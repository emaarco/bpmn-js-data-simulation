import type { Variables } from './model.js'
import { isVariables } from './variables.js'

export type StartFieldType = 'number' | 'boolean' | 'text' | 'json' | 'auto'

export interface StartField {
  name: string
  type: StartFieldType
  usedBy: string[]
}

export interface ElementVariableUsage {
  elementName: string
  conditionReads: string[]
  inputReads: string[]
  inputTargets: string[]
  outputReads: string[]
  outputTargets: string[]
}

export type FieldValue = { ok: true; value: unknown } | { ok: false; reason: string }

export interface StartFieldHints {
  examples?: Variables[]
  taskResultNames?: string[]
}

export function deriveStartFields(
  usages: ElementVariableUsage[],
  { examples = [], taskResultNames = [] }: StartFieldHints = {},
): StartField[] {
  const written = new Set([...usages.flatMap(usage => usage.outputTargets.map(topLevelName)), ...taskResultNames])
  const usedBy = new Map<string, Set<string>>()

  for (const usage of usages) {
    const localNames = new Set(usage.inputTargets.map(topLevelName))
    for (const name of [...usage.conditionReads, ...usage.inputReads, ...usage.outputReads]) {
      if (written.has(name) || localNames.has(name)) continue
      if (!usedBy.has(name)) usedBy.set(name, new Set())
      usedBy.get(name)!.add(usage.elementName)
    }
  }

  return [...usedBy.entries()].map(([name, elements]) => ({
    name,
    type: inferType(examples.map(example => example[name]).find(value => value !== undefined)),
    usedBy: [...elements],
  }))
}

export function parseFieldValue(field: StartField, raw: string | boolean): FieldValue {
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

export function formatFieldValue(field: StartField, value: unknown): string | boolean {
  if (field.type === 'boolean') return value === true
  if (value === undefined || value === null) return ''
  if (typeof value === 'string' && field.type !== 'json') return value
  return field.type === 'number' ? String(value) : JSON.stringify(value)
}

export function applyFieldValues(base: Variables, values: Record<string, unknown>): Variables {
  const variables = { ...base }
  for (const [name, value] of Object.entries(values)) {
    if (value === undefined) delete variables[name]
    else variables[name] = value
  }
  return variables
}

function topLevelName(path: string): string {
  return path.split('.')[0]
}

function inferType(example: unknown): StartFieldType {
  if (typeof example === 'number') return 'number'
  if (typeof example === 'boolean') return 'boolean'
  if (typeof example === 'string') return 'text'
  if (Array.isArray(example) || isVariables(example)) return 'json'
  return 'auto'
}
