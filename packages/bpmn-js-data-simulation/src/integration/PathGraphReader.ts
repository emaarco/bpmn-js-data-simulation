import type { GatewayKind, PathGraph, PathNode } from '../domain/model.js'
import type { EngineAdapter, ModdleElement } from '../engines/types.js'
import { activityRouting, flowNodesOf, is, outgoingSequenceFlows, readOutgoingFlow } from '../utils/diagramElements.js'
import type { DiagramElement, ElementRegistry } from './tokenSimulation.js'

const GATEWAY_KINDS: Record<string, GatewayKind> = {
  'bpmn:ExclusiveGateway': 'exclusive',
  'bpmn:InclusiveGateway': 'inclusive',
}

export class PathGraphReader {
  constructor(
    private readonly elementRegistry: ElementRegistry,
    private readonly engine: EngineAdapter,
  ) {}

  read(measureNames: readonly string[]): PathGraph {
    const flowNodes = flowNodesOf(this.elementRegistry)
    const startEventsIn = (container: ModdleElement) =>
      flowNodes.filter(node => is(node, 'bpmn:StartEvent') && node.businessObject.$parent === container)
    const processStartIds = flowNodes
      .filter(node => is(node, 'bpmn:StartEvent') && this.isProcess(node.businessObject.$parent))
      .map(node => node.id)

    return {
      startIds: processStartIds,
      nodes: flowNodes.map(node => this.toPathNode(node, startEventsIn, measureNames)),
    }
  }

  private toPathNode(
    node: DiagramElement,
    startEventsIn: (container: ModdleElement) => DiagramElement[],
    measureNames: readonly string[],
  ): PathNode {
    const entersSubProcess = is(node, 'bpmn:SubProcess') && !node.businessObject.triggeredByEvent
    return {
      id: node.id,
      ...this.routingOf(node),
      outgoing: outgoingSequenceFlows(node).map(flow => ({
        ...readOutgoingFlow(flow, this.engine),
        targetId: flow.target!.id,
      })),
      nestedStartIds: entersSubProcess ? startEventsIn(node.businessObject).map(start => start.id) : [],
      measures: Object.fromEntries(measureNames.map(name => [name, this.readMeasure(node.businessObject, name)])),
    }
  }

  private routingOf(node: DiagramElement): Pick<PathNode, 'routingKind' | 'refusalReason'> {
    const gatewayKind = GATEWAY_KINDS[node.type]
    if (gatewayKind) return { routingKind: gatewayKind }
    switch (activityRouting(node, this.engine)) {
      case 'by-conditions':
        return { routingKind: 'activity' }
      case 'refused':
        return { routingKind: 'activity', refusalReason: this.engine.activityConditionRefusal }
      case 'none':
        return {}
    }
  }

  private isProcess(element: unknown): boolean {
    return (element as ModdleElement | undefined)?.$type === 'bpmn:Process'
  }

  private readMeasure(businessObject: ModdleElement, name: string): number {
    const attribute = (businessObject.$attrs as Record<string, unknown> | undefined)?.[name]
    const value = typeof attribute === 'string' && attribute.trim() ? Number(attribute) : Number.NaN
    return Number.isFinite(value) ? value : 0
  }
}
