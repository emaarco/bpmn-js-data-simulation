import type { Evaluation, Mapping, MultiInstanceLoop, Variables } from '../domain/model.js'

export type EngineId = 'zeebe' | 'camunda7'

export interface ModdleElement {
  $type: string
  [property: string]: unknown
}

export type TaskResultPropagation = 'always' | 'without-output-mappings'

export interface EngineAdapter {
  id: EngineId
  label: string
  expressionLanguage: string
  taskResultPropagation: TaskResultPropagation
  activityConditionRefusal?: string
  writeVariable(variables: Variables, target: string, value: unknown): Variables
  readIoMappings(element: ModdleElement): { inputs: Mapping[]; outputs: Mapping[] }
  readCondition(sequenceFlow: ModdleElement): string | undefined
  /** Optional: without it, a multi-instance activity runs once, as in the plain token simulation. */
  readLoop?(activity: ModdleElement): MultiInstanceLoop | undefined
  canEvaluate(expression: string): boolean
  evaluate(expression: string, variables: Variables): Evaluation
  readVariableNames(expression: string): string[]
}
