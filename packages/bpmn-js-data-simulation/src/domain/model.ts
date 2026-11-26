export type Variables = Record<string, unknown>

export type Evaluation = { ok: true; value: unknown } | { ok: false; reason: string }

export interface Mapping {
  source: string
  target: string
}

export type GatewayKind = 'exclusive' | 'inclusive'

export type RoutingKind = GatewayKind | 'activity'

export interface OutgoingFlow {
  id: string
  name?: string
  expression?: string
  isDefault: boolean
}

export type FlowOutcome = 'taken' | 'not-taken' | 'error' | 'skipped'

export interface FlowEvaluation {
  flow: OutgoingFlow
  outcome: FlowOutcome
  value?: unknown
  reason?: string
}

export interface RoutingDecision {
  flows: FlowEvaluation[]
  takenFlowIds: string[]
  stuckReason?: string
  refusedByEngine?: boolean
}

export interface Scenario {
  id: string
  name: string
  description?: string
  variables: Variables
  taskResults: Record<string, Variables>
}

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

export interface PathFlow extends OutgoingFlow {
  targetId: string
}

export interface PathNode {
  id: string
  routingKind?: RoutingKind
  refusalReason?: string
  outgoing: PathFlow[]
  nestedStartIds: string[]
  measures: Record<string, number>
}

export interface PathGraph {
  startIds: string[]
  nodes: PathNode[]
}

export interface SimulatedPath {
  taken: string[]
  skipped: string[]
  decisions: Record<string, RoutingDecision>
  measures: Record<string, number>
}

export interface ConditionReads {
  expression: string
  variableNames: string[]
}

export interface NumberRange {
  min: number
  max: number
  step: number
}

export type PathVariable =
  | { name: string; type: 'boolean' }
  | { name: string; type: 'number'; range: NumberRange }
  | { name: string; type: 'text' }
  | { name: string; type: 'json' }
