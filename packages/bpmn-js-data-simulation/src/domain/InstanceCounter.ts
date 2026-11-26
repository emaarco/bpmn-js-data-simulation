import type { Evaluation, InstanceCount, MultiInstanceLoop } from './model.js'

export const DEFAULT_INSTANCE_COUNT = 3

export type EvaluateExpression = (expression: string) => Evaluation

export class InstanceCounter {
  count({ cardinality, collection }: MultiInstanceLoop, evaluate?: EvaluateExpression): InstanceCount {
    if (!evaluate) return { count: DEFAULT_INSTANCE_COUNT, source: 'default' }
    if (cardinality) return this.fromCardinality(cardinality, evaluate(cardinality))
    if (collection) return this.fromCollection(collection, evaluate(collection))
    return { count: DEFAULT_INSTANCE_COUNT, source: 'default' }
  }

  private fromCardinality(expression: string, evaluation: Evaluation): InstanceCount {
    if (!evaluation.ok) return this.fallback(expression, evaluation.reason)
    const count = typeof evaluation.value === 'string' ? Number(evaluation.value) : evaluation.value
    if (typeof count !== 'number' || !Number.isInteger(count) || count < 0) {
      return this.fallback(expression, `Loop cardinality ${JSON.stringify(evaluation.value)} is not a whole number`)
    }
    return { count, source: 'cardinality', expression }
  }

  private fromCollection(expression: string, evaluation: Evaluation): InstanceCount {
    if (!evaluation.ok) return this.fallback(expression, evaluation.reason)
    if (!Array.isArray(evaluation.value)) {
      return this.fallback(expression, `Collection ${JSON.stringify(evaluation.value)} is not a list`)
    }
    return { count: evaluation.value.length, source: 'collection', expression }
  }

  private fallback(expression: string, reason: string): InstanceCount {
    return { count: DEFAULT_INSTANCE_COUNT, source: 'default', expression, reason }
  }
}
