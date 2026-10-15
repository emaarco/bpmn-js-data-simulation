import { evaluate, parseExpression } from 'feelin'
import type { Evaluation, Mapping, Variables } from '../../domain/model.js'
import { setVariable } from '../../domain/variables.js'
import { findExtension, listProperty, readConditionExpression } from '../moddle.js'
import type { EngineAdapter, ModdleElement } from '../types.js'

const EXPRESSION_PREFIX = '='

export const zeebeEngine: EngineAdapter = {
  id: 'zeebe',
  label: 'Zeebe',
  expressionLanguage: 'FEEL',
  taskResultPropagation: 'without-output-mappings',
  writeVariable: setVariable,
  readInputMappings: element => readMappings(element, 'inputParameters'),
  readOutputMappings: element => readMappings(element, 'outputParameters'),
  readCondition: sequenceFlow => readConditionExpression(sequenceFlow)?.body?.trim() || undefined,
  canEvaluate: expression => isFeel(expression) && parsesAsFeel(expression),
  evaluate: evaluateZeebeExpression,
  readVariableNames,
}

function readMappings(element: ModdleElement, property: string): Mapping[] {
  const ioMapping = findExtension(element, 'zeebe:IoMapping')
  return listProperty(ioMapping, property)
    .filter(parameter => typeof parameter.target === 'string' && parameter.target)
    .map(parameter => ({ source: String(parameter.source ?? ''), target: parameter.target as string }))
}

function evaluateZeebeExpression(expression: string, variables: Variables): Evaluation {
  if (!isFeel(expression)) {
    return { ok: true, value: expression }
  }
  try {
    const { value, warnings } = evaluate(feelBody(expression), variables)
    const missingVariable = warnings.find(warning => warning.type === 'NO_VARIABLE_FOUND')
    if (value === null && missingVariable) {
      return { ok: false, reason: missingVariable.message }
    }
    return { ok: true, value: toVariableValue(value) }
  } catch (error) {
    return { ok: false, reason: `Invalid FEEL: ${(error as Error).message}` }
  }
}

function readVariableNames(expression: string): string[] {
  if (!isFeel(expression)) return []
  const body = feelBody(expression)
  const read = new Set<string>()
  const bound = new Set<string>()
  parseExpression(body, {}, undefined).iterate({
    enter(node) {
      const text = body.slice(node.from, node.to)
      if (node.name === 'Name') bound.add(text)
      if (node.name !== 'VariableName') return
      const isCallee = node.node.parent?.name === 'FunctionInvocation' && node.node.prevSibling === null
      if (!isCallee) read.add(text)
    },
  })
  return [...read].filter(name => !bound.has(name))
}

function toVariableValue(value: unknown): unknown {
  if (value === undefined) return null
  return typeof value === 'object' && value !== null ? JSON.parse(JSON.stringify(value)) : value
}

function parsesAsFeel(expression: string): boolean {
  try {
    evaluate(feelBody(expression), {})
    return true
  } catch {
    return false
  }
}

function isFeel(expression: string): boolean {
  return expression.trimStart().startsWith(EXPRESSION_PREFIX)
}

function feelBody(expression: string): string {
  return expression.trimStart().slice(EXPRESSION_PREFIX.length)
}
