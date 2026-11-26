import type { ConditionReads, NumberRange, PathVariable, Variables } from './model.js'

const NICE_STEPS = [1, 2, 5, 10]
const RANGE_STEPS = 100
const NUMBER_LITERAL = /(?<![\w.])\d+(?:\.\d+)?/g

export class PathVariableDeriver {
  derive(
    conditions: readonly ConditionReads[],
    values: Variables,
    rangeOverrides: Readonly<Record<string, Partial<NumberRange>>> = {},
  ): PathVariable[] {
    const names = [...new Set(conditions.flatMap(condition => condition.variableNames))]
    return names.map(name => {
      const conditionsReadingName = conditions.filter(condition => condition.variableNames.includes(name))
      return this.variableFor(name, values[name], conditionsReadingName, rangeOverrides[name] ?? {})
    })
  }

  private variableFor(
    name: string,
    value: unknown,
    conditionsReadingName: ConditionReads[],
    rangeOverride: Partial<NumberRange>,
  ): PathVariable {
    if (typeof value === 'boolean') return { name, type: 'boolean' }
    if (typeof value === 'number') {
      const comparedNumbers = conditionsReadingName.flatMap(condition => this.numberLiterals(condition.expression))
      return { name, type: 'number', range: this.rangeAround(value, comparedNumbers, rangeOverride) }
    }
    if (value === undefined || typeof value === 'string') return { name, type: 'text' }
    return { name, type: 'json' }
  }

  // The value itself is not doubled: a slider dragged to the end then keeps its range when derived again.
  private rangeAround(value: number, comparedNumbers: number[], override: Partial<NumberRange>): NumberRange {
    const min = override.min ?? 0
    const max = override.max ?? this.niceCeiling(Math.max(Math.abs(value), 2 * Math.max(0, ...comparedNumbers)))
    return { min, max, step: override.step ?? (max - min) / RANGE_STEPS }
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
