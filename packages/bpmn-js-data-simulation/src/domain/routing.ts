import type { Evaluation, FlowEvaluation, FlowOutcome, GatewayKind, OutgoingFlow, RoutingDecision } from './model.js'

export type EvaluateCondition = (expression: string) => Evaluation

export function routeGateway(
  kind: GatewayKind,
  outgoing: OutgoingFlow[],
  evaluateCondition: EvaluateCondition,
): RoutingDecision {
  const conditional = outgoing.filter(flow => !flow.isDefault)
  const defaultFlow = outgoing.find(flow => flow.isDefault)
  const evaluations: FlowEvaluation[] = []

  for (const flow of conditional) {
    const alreadyDecided = kind === 'exclusive' && evaluations.some(isDecisive)
    evaluations.push(alreadyDecided ? { flow, outcome: 'skipped' } : evaluateFlow(flow, evaluateCondition))
  }

  const failed = evaluations.find(evaluation => evaluation.outcome === 'error')
  if (failed) {
    return stuck(
      evaluations,
      defaultFlow,
      `Condition of "${failed.flow.name ?? failed.flow.id}" failed: ${failed.reason}`,
    )
  }

  const taken = evaluations.filter(evaluation => evaluation.outcome === 'taken')
  if (taken.length) {
    return withDefault(
      evaluations,
      defaultFlow,
      'not-taken',
      taken.map(evaluation => evaluation.flow.id),
    )
  }

  if (defaultFlow) {
    return withDefault(evaluations, defaultFlow, 'taken', [defaultFlow.id])
  }

  return stuck(evaluations, defaultFlow, 'No condition is true and there is no default flow')
}

function evaluateFlow(flow: OutgoingFlow, evaluateCondition: EvaluateCondition): FlowEvaluation {
  if (flow.expression === undefined) {
    return { flow, outcome: 'error', reason: 'Missing condition' }
  }
  const evaluation = evaluateCondition(flow.expression)
  if (!evaluation.ok) {
    return { flow, outcome: 'error', reason: evaluation.reason }
  }
  if (typeof evaluation.value !== 'boolean') {
    return {
      flow,
      outcome: 'error',
      value: evaluation.value,
      reason: `Expected a boolean but got ${describe(evaluation.value)}`,
    }
  }
  return { flow, outcome: evaluation.value ? 'taken' : 'not-taken', value: evaluation.value }
}

function isDecisive(evaluation: FlowEvaluation): boolean {
  return evaluation.outcome === 'taken' || evaluation.outcome === 'error'
}

function withDefault(
  evaluations: FlowEvaluation[],
  defaultFlow: OutgoingFlow | undefined,
  defaultOutcome: FlowOutcome,
  takenFlowIds: string[],
): RoutingDecision {
  const flows = defaultFlow ? [...evaluations, { flow: defaultFlow, outcome: defaultOutcome }] : evaluations
  return { flows, takenFlowIds }
}

function stuck(
  evaluations: FlowEvaluation[],
  defaultFlow: OutgoingFlow | undefined,
  stuckReason: string,
): RoutingDecision {
  return { ...withDefault(evaluations, defaultFlow, 'skipped', []), stuckReason }
}

function describe(value: unknown): string {
  if (value === null || value === undefined) return 'null'
  return `${typeof value} ${JSON.stringify(value)}`
}
