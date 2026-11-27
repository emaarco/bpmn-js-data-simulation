import type { ConditionReads, NumberRange, PathVariable, Variables } from './model.js'

const NICE_STEPS = [1, 2, 5, 10]
const RANGE_STEPS = 100
const NUMBER_LITERAL = /(?<![\w.])\d+(?:\.\d+)?/g
const COMPARISON = String.raw`(?:<=|>=|==|!=|<|>|=|\b(?:lt|gt|le|ge|eq|ne)\b)`
const RELATIONAL = String.raw`(?:<=|>=|<|>|\b(?:lt|gt|le|ge)\b)`
const EQUALITY = String.raw`(?:==|!=|=|\b(?:eq|ne)\b)`
// Before a boolean operand: the start, a grouping (not a call) parenthesis, not(, !, and, or.
const BOOLEAN_LEFT = String.raw`(?:^|(?<![\w$.])\(|\bnot\s*\(|!|&&|\|\||\b(?:and|or|not)\b)`
const BOOLEAN_RIGHT = String.raw`(?=$|\)|&&|\|\||\b(?:and|or)\b)`

export class PathVariableDeriver {
  derive(
    conditions: readonly ConditionReads[],
    values: Variables,
    rangeOverrides: Readonly<Record<string, Partial<NumberRange>>> = {},
  ): PathVariable[] {
    const names = [...new Set(conditions.flatMap(condition => condition.variableNames))]
    return names.map(name => {
      const conditionsReadingName = conditions.filter(condition => condition.variableNames.includes(name))
      return this.variableFor(name, values, conditionsReadingName, rangeOverrides[name] ?? {})
    })
  }

  private variableFor(
    name: string,
    values: Variables,
    conditionsReadingName: ConditionReads[],
    rangeOverride: Partial<NumberRange>,
  ): PathVariable {
    const value = values[name]
    const type = value === undefined ? this.typeFromConditions(name, conditionsReadingName) : typeof value
    if (type === 'boolean') return { name, type: 'boolean' }
    if (type === 'number') {
      const comparedNumbers = conditionsReadingName.flatMap(condition => [
        ...this.numberLiterals(condition.expression),
        ...this.numbersOfOtherVariables(name, condition, values),
      ])
      return { name, type: 'number', range: this.rangeAround(Number(value ?? 0), comparedNumbers, rangeOverride) }
    }
    if (value === undefined || typeof value === 'string') return { name, type: 'text' }
    return { name, type: 'json' }
  }

  // Without a value the conditions tell the type: compared with a number or by <, <=, > or >=, or used as a condition of its own.
  private typeFromConditions(name: string, conditions: ConditionReads[]): 'number' | 'boolean' | undefined {
    const variable = String.raw`(?<![\w.$])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\w.(])`
    const comparedWithNumber = new RegExp(
      String.raw`${variable}\s*${COMPARISON}\s*-?\d|\d\s*${COMPARISON}\s*${variable}|${variable}\s*${RELATIONAL}|${RELATIONAL}\s*${variable}`,
    )
    const usedAsBoolean = new RegExp(
      String.raw`${BOOLEAN_LEFT}\s*${variable}\s*${BOOLEAN_RIGHT}|${variable}\s*${EQUALITY}\s*(?:true|false)\b|\b(?:true|false)\s*${EQUALITY}\s*${variable}`,
    )
    const bodies = conditions.map(condition => this.body(condition.expression))
    if (bodies.some(body => comparedWithNumber.test(body))) return 'number'
    if (bodies.some(body => usedAsBoolean.test(body))) return 'boolean'
    return undefined
  }

  // The expression without its FEEL `=` or its JUEL `${…}`.
  private body(expression: string): string {
    const trimmed = expression.trim()
    const juel = /^\$\{([\s\S]*)\}$/.exec(trimmed)
    if (juel) return juel[1].trim()
    return trimmed.replace(/^=/, '').trim()
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

  // The numbers the other variables of the condition hold, e.g. a minimum score the variable is compared with.
  private numbersOfOtherVariables(name: string, condition: ConditionReads, values: Variables): number[] {
    return condition.variableNames
      .filter(otherName => otherName !== name)
      .map(otherName => values[otherName])
      .filter((otherValue): otherValue is number => typeof otherValue === 'number')
  }

  private numberLiterals(expression: string): number[] {
    return (expression.match(NUMBER_LITERAL) ?? []).map(Number)
  }
}
