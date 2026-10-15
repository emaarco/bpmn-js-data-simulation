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
