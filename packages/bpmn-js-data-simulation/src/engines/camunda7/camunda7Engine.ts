import type { Evaluation, Mapping, Variables } from '../../domain/model.js'
import { findExtension, listProperty, readConditionExpression } from '../moddle.js'
import type { EngineAdapter, ModdleElement } from '../types.js'
import { evaluateJuelTemplate, parseJuelTemplate, readJuelVariableNames } from './juel.js'

export const camunda7Engine: EngineAdapter = {
  id: 'camunda7',
  label: 'Camunda 7',
  expressionLanguage: 'JUEL',
  taskResultPropagation: 'always',
  writeVariable: (variables, target, value) => ({ ...variables, [target]: value }),
  readInputMappings: element => readMappings(element, 'inputParameters'),
  readOutputMappings: element => readMappings(element, 'outputParameters'),
  readCondition,
  canEvaluate,
  evaluate: evaluateCamundaExpression,
  readVariableNames,
}

function readMappings(element: ModdleElement, property: string): Mapping[] {
  const inputOutput = findExtension(element, 'camunda:InputOutput')
  return listProperty(inputOutput, property)
    .filter(parameter => typeof parameter.name === 'string' && parameter.name && !parameter.definition)
    .map(parameter => ({
      source: typeof parameter.value === 'string' ? parameter.value : '',
      target: parameter.name as string,
    }))
}

function readCondition(sequenceFlow: ModdleElement): string | undefined {
  const condition = readConditionExpression(sequenceFlow)
  const isJuel = !condition?.language || condition.language.toLowerCase() === 'juel'
  return isJuel ? condition?.body?.trim() || undefined : undefined
}

function canEvaluate(expression: string): boolean {
  try {
    parseJuelTemplate(expression)
    return true
  } catch {
    return false
  }
}

function readVariableNames(expression: string): string[] {
  try {
    return readJuelVariableNames(parseJuelTemplate(expression))
  } catch {
    return []
  }
}

function evaluateCamundaExpression(expression: string, variables: Variables): Evaluation {
  if (!expression) {
    return { ok: true, value: null }
  }
  try {
    return { ok: true, value: evaluateJuelTemplate(parseJuelTemplate(expression), variables) }
  } catch (error) {
    return { ok: false, reason: (error as Error).message }
  }
}
