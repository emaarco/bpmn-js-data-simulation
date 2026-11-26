import type { FlowEvaluation, GatewayKind, OutgoingFlow, RoutingDecision, RoutingKind } from '../domain/model.js'
import { GatewayRouter } from '../domain/GatewayRouter.js'
import type { ConditionInput, DataSimulationStore } from '../simulation/DataSimulationStore.js'
import {
  activityRouting,
  elementName,
  findProcessInstance,
  outgoingSequenceFlows,
  readOutgoingFlow,
} from '../utils/diagramElements.js'
import type { DataSimulation } from './DataSimulation.js'
import type { BehaviorContext, DiagramElement, Scope, Simulator } from './tokenSimulation.js'

export class DataGateways {
  static $inject = ['dataSimulation', 'dataSimulationStore', 'simulator']

  private readonly router = new GatewayRouter()

  constructor(
    private readonly dataSimulation: DataSimulation,
    private readonly store: DataSimulationStore,
    private readonly simulator: Simulator,
  ) {}

  isDataDriven(gateway: DiagramElement): boolean {
    const engine = this.dataSimulation.getEngine()
    const outgoing = this.outgoingFlows(gateway)
    return (
      this.dataSimulation.isEnabled() &&
      outgoing.length > 1 &&
      outgoing
        .filter(flow => !flow.isDefault)
        .every(flow => flow.expression !== undefined && engine.canEvaluate(flow.expression))
    )
  }

  routesActivityByData(activity: DiagramElement): boolean {
    return this.dataSimulation.isEnabled() && activityRouting(activity, this.dataSimulation.getEngine()) !== 'none'
  }

  exit(context: BehaviorContext, kind: GatewayKind): void {
    const { element: gateway, scope } = context
    const decision = this.decide(gateway, scope, kind)
    if (decision.stuckReason) {
      this.waitForRetry(gateway, scope)
      return
    }
    for (const flow of this.takenFlows(gateway, decision)) {
      this.simulator.enter({ element: flow, scope: scope.parent })
    }
  }

  exitActivity(context: BehaviorContext, leaveThrough: (flows: DiagramElement[]) => void): void {
    const { element: activity, scope } = context
    const decision = this.decide(activity, scope, 'activity')
    if (decision.stuckReason) {
      this.waitForRetry(activity, scope)
      return
    }
    leaveThrough(this.takenFlows(activity, decision))
  }

  recordClickDecision(context: BehaviorContext, kind: GatewayKind): void {
    if (!this.dataSimulation.isEnabled()) return
    const { element: gateway, scope } = context
    const { activeOutgoing } = this.simulator.getConfig(gateway)
    const chosen = ([] as unknown[]).concat(activeOutgoing ?? [])
    const outgoing = this.outgoingFlows(gateway)
    if (outgoing.length < 2 || !chosen.length) return
    const flows: FlowEvaluation[] = outgoing.map(flow =>
      chosen.some(candidate => (candidate as DiagramElement).id === flow.id)
        ? { flow, outcome: 'taken', reason: 'Chosen by click' }
        : { flow, outcome: 'skipped', reason: 'Not chosen by click' },
    )
    const decision = {
      flows,
      takenFlowIds: flows.filter(flow => flow.outcome === 'taken').map(flow => flow.flow.id),
    }
    this.record(gateway, scope, kind, 'click', decision, [])
  }

  private decide(element: DiagramElement, scope: Scope, kind: RoutingKind): RoutingDecision {
    const engine = this.dataSimulation.getEngine()
    const variables = this.dataSimulation.getVariables(scope)
    const outgoing = this.outgoingFlows(element)
    const refusal = kind === 'activity' ? engine.activityConditionRefusal : undefined
    const decision = refusal
      ? this.router.refuse(outgoing, refusal)
      : this.router.route(kind, outgoing, expression => engine.evaluate(expression, variables))
    const names = outgoing.flatMap(flow => (flow.expression ? engine.readVariableNames(flow.expression) : []))
    const inputs = [...new Set(names)].map(name => ({ name, value: structuredClone(variables[name]) }))
    this.record(element, scope, kind, 'data', decision, inputs)
    return decision
  }

  private takenFlows(element: DiagramElement, decision: RoutingDecision): DiagramElement[] {
    return outgoingSequenceFlows(element).filter(flow => decision.takenFlowIds.includes(flow.id))
  }

  private record(
    element: DiagramElement,
    scope: Scope,
    gatewayKind: RoutingKind,
    chosenBy: 'data' | 'click',
    decision: RoutingDecision,
    inputs: ConditionInput[],
  ): void {
    this.store.record({
      kind: 'decision',
      instanceId: findProcessInstance(scope).id,
      elementId: element.id,
      elementName: elementName(element),
      gatewayKind,
      chosenBy,
      decision,
      inputs,
    })
  }

  private waitForRetry(element: DiagramElement, scope: Scope): void {
    const waitingScope = this.simulator.createScope({ element, parent: scope.parent, initiator: scope }).start()
    this.store.addWaiting(findProcessInstance(scope).id, {
      scopeId: waitingScope.id,
      gatewayId: element.id,
      gatewayName: elementName(element),
    })
    const retry = { element, type: 'continue', interrupting: false, boundary: false }
    const subscription = this.simulator.subscribe(waitingScope, retry, initiator => {
      subscription.remove()
      this.simulator.exit({ element, scope: waitingScope, initiator })
    })
  }

  private outgoingFlows(element: DiagramElement): OutgoingFlow[] {
    const engine = this.dataSimulation.getEngine()
    return outgoingSequenceFlows(element).map(flow => readOutgoingFlow(flow, engine))
  }
}
