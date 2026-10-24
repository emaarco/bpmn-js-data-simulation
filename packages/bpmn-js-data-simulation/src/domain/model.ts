export type Variables = Record<string, unknown>

export type Evaluation = { ok: true; value: unknown } | { ok: false; reason: string }

export interface Mapping {
  source: string
  target: string
}

export type GatewayKind = 'exclusive' | 'inclusive'

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
