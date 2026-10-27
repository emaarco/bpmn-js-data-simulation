import { evaluate, parseExpression } from 'feelin'
import type { Evaluation, Mapping, Variables } from '../../domain/model.js'
import { findExtension, listProperty, readConditionExpression } from '../../utils/moddle.js'
import { setVariable } from '../../utils/variables.js'
import type { EngineAdapter, ModdleElement, TaskResultPropagation } from '../types.js'

const EXPRESSION_PREFIX = '='

export class ZeebeEngine implements EngineAdapter {
  readonly id = 'zeebe'
  readonly label = 'Zeebe'
  readonly expressionLanguage = 'FEEL'
  readonly taskResultPropagation: TaskResultPropagation = 'without-output-mappings'

  writeVariable(variables: Variables, target: string, value: unknown): Variables {
    return setVariable(variables, target, value)
  }

  readIoMappings(element: ModdleElement): { inputs: Mapping[]; outputs: Mapping[] } {
    return {
      inputs: this.readMappings(element, 'inputParameters'),
      outputs: this.readMappings(element, 'outputParameters'),
    }
  }

  readCondition(sequenceFlow: ModdleElement): string | undefined {
    return readConditionExpression(sequenceFlow)?.body?.trim() || undefined
  }

  canEvaluate(expression: string): boolean {
    return this.isFeel(expression) && this.parsesAsFeel(expression)
  }

  evaluate(expression: string, variables: Variables): Evaluation {
    if (!this.isFeel(expression)) {
      return { ok: true, value: expression }
    }
    try {
      const { value, warnings } = evaluate(this.feelBody(expression), variables)
      const missingVariable = warnings.find(warning => warning.type === 'NO_VARIABLE_FOUND')
      if (value === null && missingVariable) {
        return { ok: false, reason: missingVariable.message }
      }
      return { ok: true, value: this.toVariableValue(value) }
    } catch (error) {
      return { ok: false, reason: `Invalid FEEL: ${(error as Error).message}` }
    }
  }

  readVariableNames(expression: string): string[] {
    if (!this.isFeel(expression)) return []
    const body = this.feelBody(expression)
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

  private readMappings(element: ModdleElement, property: string): Mapping[] {
    const ioMapping = findExtension(element, 'zeebe:IoMapping')
    return listProperty(ioMapping, property)
      .filter(parameter => typeof parameter.target === 'string' && parameter.target)
      .map(parameter => ({ source: String(parameter.source ?? ''), target: parameter.target as string }))
  }

  private toVariableValue(value: unknown): unknown {
    if (value === undefined) return null
    return typeof value === 'object' && value !== null ? JSON.parse(JSON.stringify(value)) : value
  }

  private parsesAsFeel(expression: string): boolean {
    try {
      evaluate(this.feelBody(expression), {})
      return true
    } catch {
      return false
    }
  }

  private isFeel(expression: string): boolean {
    return expression.trimStart().startsWith(EXPRESSION_PREFIX)
  }

  private feelBody(expression: string): string {
    return expression.trimStart().slice(EXPRESSION_PREFIX.length)
  }
}
