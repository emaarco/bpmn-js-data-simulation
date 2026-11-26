import type { ConditionReads, NumberRange, PathVariable, Variables } from './model.js'

const NICE_STEPS = [1, 2, 5, 10]
const RANGE_STEPS = 100
const NUMBER_LITERAL = /(?<![\w.])\d+(?:\.\d+)?/g

export class PathVariableDeriver {
  derive(conditions: readonly ConditionReads[], values: Variables): PathVariable[] {
    const names = [...new Set(conditions.flatMap(condition => condition.variableNames))]
    return names.map(name => {
      const conditionsReadingName = conditions.filter(condition => condition.variableNames.includes(name))
      return this.variableFor(name, values[name], conditionsReadingName)
    })
  }

  private variableFor(name: string, value: unknown, conditionsReadingName: ConditionReads[]): PathVariable {
    if (typeof value === 'boolean') return { name, type: 'boolean' }
    if (typeof value === 'number') {
      const comparedNumbers = conditionsReadingName.flatMap(condition => this.numberLiterals(condition.expression))
      return { name, type: 'number', range: this.rangeAround(value, comparedNumbers) }
    }
    if (value === undefined || typeof value === 'string') return { name, type: 'text' }
    return { name, type: 'json' }
  }

  private rangeAround(value: number, comparedNumbers: number[]): NumberRange {
    const max = this.niceCeiling(2 * Math.max(Math.abs(value), ...comparedNumbers))
    return { min: 0, max, step: max / RANGE_STEPS }
  }

  private niceCeiling(value: number): number {
    if (value <= 0) return 1
    const magnitude = 10 ** Math.floor(Math.log10(value))
    return NICE_STEPS.find(step => step * magnitude >= value)! * magnitude
  }

  private numberLiterals(expression: string): number[] {
    return (expression.match(NUMBER_LITERAL) ?? []).map(Number)
  }
}
