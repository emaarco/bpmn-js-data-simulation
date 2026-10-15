import type { RoutingDecision } from '../domain/model.js'
import type { DecisionLogEntry, SimulationSnapshot } from '../simulation/DataSimulationStore.js'
import { createDecisionCard, createOutcomeBadge } from '../ui/overlayContent.js'
import { placePopover } from '../ui/popoverPlacement.js'
import { inShadow } from '../ui/shadow.js'
import type { DataSimulation } from './DataSimulation.js'
import type { Canvas, DiagramElement, ElementRegistry, EventBus, Overlays } from './tokenSimulation.js'

const OUTCOME_OVERLAY = 'bds-flow-outcome'
const DECIDED_MARKER = 'bds-gateway--decided'
const STUCK_MARKER = 'bds-gateway--stuck'
const BADGE_DISTANCE = 38
const BADGE_MIN_SCALE = 1

interface Popover {
  gateway: DiagramElement
  card: HTMLElement
}

export class DataSimulationOverlays {
  static $inject = ['eventBus', 'overlays', 'elementRegistry', 'canvas', 'dataSimulation']

  private snapshot: SimulationSnapshot
  private hoveredGatewayId?: string
  private readonly pinnedGatewayIds = new Set<string>()
  private markedGateways: DiagramElement[] = []
  private popovers: Popover[] = []
  private readonly popoverLayer = inShadow()
  private renderedState = ''

  constructor(
    eventBus: EventBus,
    private readonly overlays: Overlays,
    private readonly elementRegistry: ElementRegistry,
    private readonly canvas: Canvas,
    dataSimulation: DataSimulation,
  ) {
    this.snapshot = dataSimulation.getSnapshot()
    const unsubscribe = dataSimulation.subscribe(snapshot => {
      this.snapshot = snapshot
      this.render()
    })
    eventBus.on('element.hover', ({ element }: { element: DiagramElement }) => {
      this.hoveredGatewayId = gatewayOf(element)
      this.render()
    })
    eventBus.on('element.click', ({ element }: { element: DiagramElement }) => {
      if (!isGateway(element)) return
      if (!this.pinnedGatewayIds.delete(element.id)) this.pinnedGatewayIds.add(element.id)
      this.render()
    })
    eventBus.on(['canvas.viewbox.changed', 'canvas.resized'], () => this.placePopovers())
    canvas.getContainer().append(this.popoverLayer)
    eventBus.on('diagram.destroy', () => {
      unsubscribe()
      this.popoverLayer.remove()
    })
  }

  private render(): void {
    const decisions = latestDecisionPerGateway(this.snapshot)
    const shownPerGateway = new Map(decisions.map(entry => [entry.elementId, entry]))
    for (const entry of latestStuckDecisionPerGateway(this.snapshot)) shownPerGateway.set(entry.elementId, entry)
    const shown = [...shownPerGateway.values()]
    const cards = shown.filter(
      ({ elementId }) => elementId === this.hoveredGatewayId || this.pinnedGatewayIds.has(elementId),
    )

    const state = JSON.stringify([
      decisions.map(entry => entry.id),
      shown.map(entry => entry.id),
      cards.map(entry => [entry.id, this.pinnedGatewayIds.has(entry.elementId)]),
    ])
    if (state === this.renderedState) return
    this.renderedState = state

    this.overlays.remove({ type: OUTCOME_OVERLAY })
    this.unmarkGateways()
    for (const entry of decisions) this.showOutcomes(entry.decision)
    for (const entry of shown) this.markGateway(entry)
    this.showCards(cards)
  }

  private markGateway({ elementId, decision }: DecisionLogEntry): void {
    const gateway = this.elementRegistry.get(elementId)
    if (!gateway) return
    this.canvas.addMarker(gateway, decision.stuckReason ? STUCK_MARKER : DECIDED_MARKER)
    this.markedGateways.push(gateway)
  }

  private unmarkGateways(): void {
    for (const gateway of this.markedGateways) {
      this.canvas.removeMarker(gateway, DECIDED_MARKER)
      this.canvas.removeMarker(gateway, STUCK_MARKER)
    }
    this.markedGateways = []
  }

  private showOutcomes(decision: RoutingDecision): void {
    for (const { flow, outcome, reason } of decision.flows) {
      const connection = this.elementRegistry.get(flow.id)
      if (!connection?.waypoints) continue
      const badge = createOutcomeBadge(outcome, reason, flow.isDefault)
      badge.classList.add('bds-outcome--on-flow')
      this.overlays.add(connection, OUTCOME_OVERLAY, {
        position: badgePosition(connection.waypoints),
        scale: { min: BADGE_MIN_SCALE },
        html: inShadow(badge),
      })
    }
  }

  private showCards(entries: DecisionLogEntry[]): void {
    this.popovers = entries.flatMap(entry => {
      const gateway = this.elementRegistry.get(entry.elementId)
      if (!gateway) return []
      const close = () => {
        this.pinnedGatewayIds.delete(entry.elementId)
        this.render()
      }
      const card = createDecisionCard(entry, this.pinnedGatewayIds.has(entry.elementId) ? close : undefined)
      card.classList.add('bds-popover')
      card.dataset.elementId = entry.elementId
      return [{ gateway, card }]
    })
    this.popoverLayer.shadowRoot!.replaceChildren(...this.popovers.map(({ card }) => card))
    this.placePopovers()
  }

  private placePopovers(): void {
    const container = this.canvas.getContainer()
    const bounds = { width: container.clientWidth, height: container.clientHeight }
    for (const { gateway, card } of this.popovers) {
      card.style.maxHeight = ''
      const { left, top, maxHeight, hidden } = placePopover(
        this.canvas.getAbsoluteBBox(gateway),
        { width: card.offsetWidth, height: card.offsetHeight },
        bounds,
      )
      card.hidden = hidden
      card.style.left = `${left}px`
      card.style.top = `${top}px`
      card.style.maxHeight = maxHeight === undefined ? '' : `${maxHeight}px`
    }
  }
}

function isGateway(element: DiagramElement): boolean {
  return element.type === 'bpmn:ExclusiveGateway' || element.type === 'bpmn:InclusiveGateway'
}

function gatewayOf(element: DiagramElement): string | undefined {
  if (isGateway(element)) return element.id
  if (element.type === 'bpmn:SequenceFlow' && element.source && isGateway(element.source)) return element.source.id
  return undefined
}

function latestDecisionPerGateway({ log, selectedInstanceId }: SimulationSnapshot): DecisionLogEntry[] {
  const latest = new Map<string, DecisionLogEntry>()
  for (const entry of log) {
    if (entry.kind === 'decision' && entry.instanceId === selectedInstanceId) latest.set(entry.elementId, entry)
  }
  return [...latest.values()]
}

function latestStuckDecisionPerGateway({ instances, log }: SimulationSnapshot): DecisionLogEntry[] {
  const latest = new Map<string, DecisionLogEntry>()
  for (const instance of instances) {
    for (const { gatewayId } of instance.waiting) {
      const decision = [...log]
        .reverse()
        .find(
          (entry): entry is DecisionLogEntry =>
            entry.kind === 'decision' && entry.instanceId === instance.id && entry.elementId === gatewayId,
        )
      if (decision && (latest.get(gatewayId)?.id ?? 0) < decision.id) latest.set(gatewayId, decision)
    }
  }
  return [...latest.values()]
}

function badgePosition(waypoints: Array<{ x: number; y: number }>): { left: number; top: number } {
  const [start, next] = waypoints
  const length = Math.hypot(next.x - start.x, next.y - start.y) || 1
  const distance = Math.min(BADGE_DISTANCE, length / 2)
  const x = start.x + ((next.x - start.x) / length) * distance
  const y = start.y + ((next.y - start.y) / length) * distance
  const minX = Math.min(...waypoints.map(point => point.x))
  const minY = Math.min(...waypoints.map(point => point.y))
  return { left: x - minX, top: y - minY }
}
