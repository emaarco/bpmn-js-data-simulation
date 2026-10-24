import type { RoutingDecision } from '../domain/model.js'
import type { DecisionLogEntry, SimulationSnapshot } from '../simulation/DataSimulationStore.js'
import { GatewayDecisionView } from '../simulation/GatewayDecisionView.js'
import { DecisionCard } from '../ui/DecisionCard.js'
import { OutcomeBadge } from '../ui/OutcomeBadge.js'
import { badgePosition } from '../utils/badgePosition.js'
import { gatewayOf, isGateway } from '../utils/diagramElements.js'
import { placePopover } from '../utils/popoverPlacement.js'
import { inShadow } from '../utils/shadow.js'
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
    const { decisions, shown } = new GatewayDecisionView(this.snapshot)
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
      const badge = new OutcomeBadge(outcome, reason, flow.isDefault).element
      badge.classList.add('bds-outcome--on-flow')
      this.overlays.add(connection, OUTCOME_OVERLAY, {
        position: badgePosition(connection.waypoints, BADGE_DISTANCE),
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
      const card = new DecisionCard(entry, this.pinnedGatewayIds.has(entry.elementId) ? close : undefined).element
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
