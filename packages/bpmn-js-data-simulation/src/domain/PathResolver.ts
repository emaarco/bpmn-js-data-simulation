import { type EvaluateCondition, GatewayRouter } from './GatewayRouter.js'
import type { PathFlow, PathGraph, PathNode, RoutingDecision, SimulatedPath } from './model.js'

export class PathResolver {
  private readonly router = new GatewayRouter()

  resolve(graph: PathGraph, evaluateCondition: EvaluateCondition): SimulatedPath {
    const nodes = new Map(graph.nodes.map(node => [node.id, node]))
    const takenIds = new Set<string>()
    const decisions: Record<string, RoutingDecision> = {}
    const pendingIds = [...graph.startIds]

    while (pendingIds.length) {
      const node = nodes.get(pendingIds.shift()!)
      if (!node || takenIds.has(node.id)) continue
      takenIds.add(node.id)
      pendingIds.push(...node.nestedStartIds)
      for (const flow of this.leave(node, evaluateCondition, decisions)) {
        takenIds.add(flow.id)
        pendingIds.push(flow.targetId)
      }
    }

    const elementIds = graph.nodes.flatMap(node => [node.id, ...node.outgoing.map(flow => flow.id)])
    return {
      taken: elementIds.filter(id => takenIds.has(id)),
      skipped: elementIds.filter(id => !takenIds.has(id)),
      decisions,
      measures: this.sumMeasures(graph.nodes.filter(node => takenIds.has(node.id))),
    }
  }

  private leave(
    node: PathNode,
    evaluateCondition: EvaluateCondition,
    decisions: Record<string, RoutingDecision>,
  ): PathFlow[] {
    if (!node.gatewayKind || node.outgoing.length < 2) return node.outgoing
    const decision = this.router.route(node.gatewayKind, node.outgoing, evaluateCondition)
    decisions[node.id] = decision
    return node.outgoing.filter(flow => decision.takenFlowIds.includes(flow.id))
  }

  private sumMeasures(nodes: PathNode[]): Record<string, number> {
    const totals: Record<string, number> = {}
    for (const node of nodes) {
      for (const [name, value] of Object.entries(node.measures)) totals[name] = (totals[name] ?? 0) + value
    }
    return totals
  }
}
