import type { Evaluation, Mapping, Variables } from '../../domain/model.js'
import { findExtension, listProperty, readConditionExpression } from '../../utils/moddle.js'
import type { EngineAdapter, ModdleElement, TaskResultPropagation } from '../types.js'
import { JuelTemplate } from './juel/JuelTemplate.js'

export class Camunda7Engine implements EngineAdapter {
  readonly id = 'camunda7'
  readonly label = 'Camunda 7'
  readonly expressionLanguage = 'JUEL'
  readonly taskResultPropagation: TaskResultPropagation = 'always'

  writeVariable(variables: Variables, target: string, value: unknown): Variables {
    return { ...variables, [target]: value }
  }

  readIoMappings(element: ModdleElement): { inputs: Mapping[]; outputs: Mapping[] } {
    return {
      inputs: this.readMappings(element, 'inputParameters'),
      outputs: this.readMappings(element, 'outputParameters'),
    }
  }

  readCondition(sequenceFlow: ModdleElement): string | undefined {
    const condition = readConditionExpression(sequenceFlow)
    const isJuel = !condition?.language || condition.language.toLowerCase() === 'juel'
    return isJuel ? condition?.body?.trim() || undefined : undefined
  }

  canEvaluate(expression: string): boolean {
    try {
      JuelTemplate.parse(expression)
      return true
    } catch {
      return false
    }
  }

  evaluate(expression: string, variables: Variables): Evaluation {
    if (!expression) {
      return { ok: true, value: null }
    }
    try {
      return { ok: true, value: JuelTemplate.parse(expression).evaluate(variables) }
    } catch (error) {
      return { ok: false, reason: (error as Error).message }
    }
  }

  readVariableNames(expression: string): string[] {
    try {
      return JuelTemplate.parse(expression).variableNames()
    } catch {
      return []
    }
  }

  private readMappings(element: ModdleElement, property: string): Mapping[] {
    const inputOutput = findExtension(element, 'camunda:InputOutput')
    return listProperty(inputOutput, property)
      .filter(parameter => typeof parameter.name === 'string' && parameter.name && !parameter.definition)
      .map(parameter => ({
        source: typeof parameter.value === 'string' ? parameter.value : '',
        target: parameter.name as string,
      }))
  }
}
