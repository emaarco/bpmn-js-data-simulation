import type { FlowEvaluation, GatewayKind, OutgoingFlow, RoutingDecision } from '../domain/model.js'
import { GatewayRouter } from '../domain/GatewayRouter.js'
import type { ConditionInput, DataSimulationStore } from '../simulation/DataSimulationStore.js'
import { elementName, findProcessInstance, is } from '../utils/diagramElements.js'
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

  exit(context: BehaviorContext, kind: GatewayKind): void {
    const { element: gateway, scope } = context
    const decision = this.decide(gateway, scope, kind)
    if (decision.stuckReason) {
      this.waitForRetry(gateway, scope)
      return
    }
    for (const flowId of decision.takenFlowIds) {
      const flow = this.sequenceFlows(gateway).find(candidate => candidate.id === flowId)!
      this.simulator.enter({ element: flow, scope: scope.parent })
    }
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

  private decide(gateway: DiagramElement, scope: Scope, kind: GatewayKind): RoutingDecision {
    const engine = this.dataSimulation.getEngine()
    const variables = this.dataSimulation.getVariables(scope)
    const outgoing = this.outgoingFlows(gateway)
    const decision = this.router.route(kind, outgoing, expression => engine.evaluate(expression, variables))
    const names = outgoing.flatMap(flow => (flow.expression ? engine.readVariableNames(flow.expression) : []))
    const inputs = [...new Set(names)].map(name => ({ name, value: structuredClone(variables[name]) }))
    this.record(gateway, scope, kind, 'data', decision, inputs)
    return decision
  }

  private record(
    gateway: DiagramElement,
    scope: Scope,
    gatewayKind: GatewayKind,
    chosenBy: 'data' | 'click',
    decision: RoutingDecision,
    inputs: ConditionInput[],
  ): void {
    this.store.record({
      kind: 'decision',
      instanceId: findProcessInstance(scope).id,
      elementId: gateway.id,
      elementName: elementName(gateway),
      gatewayKind,
      chosenBy,
      decision,
      inputs,
    })
  }

  private waitForRetry(gateway: DiagramElement, scope: Scope): void {
    const waitingScope = this.simulator
      .createScope({ element: gateway, parent: scope.parent, initiator: scope })
      .start()
    this.store.addWaiting(findProcessInstance(scope).id, {
      scopeId: waitingScope.id,
      gatewayId: gateway.id,
      gatewayName: elementName(gateway),
    })
    const retry = { element: gateway, type: 'continue', interrupting: false, boundary: false }
    const subscription = this.simulator.subscribe(waitingScope, retry, initiator => {
      subscription.remove()
      this.store.removeWaiting(waitingScope.id)
      this.simulator.exit({ element: gateway, scope: waitingScope, initiator })
    })
  }

  private outgoingFlows(gateway: DiagramElement): OutgoingFlow[] {
    const engine = this.dataSimulation.getEngine()
    const defaultFlow = gateway.businessObject.default
    return this.sequenceFlows(gateway).map(flow => {
      const name = flow.businessObject.name
      return {
        id: flow.id,
        ...(typeof name === 'string' && name ? { name } : {}),
        expression: engine.readCondition(flow.businessObject),
        isDefault: flow.businessObject === defaultFlow,
      }
    })
  }

  private sequenceFlows(gateway: DiagramElement): DiagramElement[] {
    return (gateway.outgoing ?? []).filter(flow => is(flow, 'bpmn:SequenceFlow'))
  }
}
