import type { RoutingDecision } from '../domain/model.js'
import type { DecisionLogEntry, SimulationSnapshot } from '../simulation/DataSimulationStore.js'
import { GatewayDecisionView } from '../simulation/GatewayDecisionView.js'
import { DecisionCard } from '../ui/DecisionCard.js'
import { OutcomeBadge } from '../ui/OutcomeBadge.js'
import { badgePosition } from '../utils/badgePosition.js'
import { decidingElementOf, isGateway } from '../utils/diagramElements.js'
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
  element: DiagramElement
  card: HTMLElement
}

export class DataSimulationOverlays {
  static $inject = ['eventBus', 'overlays', 'elementRegistry', 'canvas', 'dataSimulation']

  private snapshot: SimulationSnapshot
  private hoveredElementId?: string
  private readonly pinnedElementIds = new Set<string>()
  private markedElements: DiagramElement[] = []
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
      this.hoveredElementId = decidingElementOf(element)
      this.render()
    })
    eventBus.on('element.click', ({ element }: { element: DiagramElement }) => {
      if (!isGateway(element) && !this.hasDecision(element)) return
      if (!this.pinnedElementIds.delete(element.id)) this.pinnedElementIds.add(element.id)
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
      ({ elementId }) => elementId === this.hoveredElementId || this.pinnedElementIds.has(elementId),
    )

    const state = JSON.stringify([
      decisions.map(entry => entry.id),
      shown.map(entry => entry.id),
      cards.map(entry => [entry.id, this.pinnedElementIds.has(entry.elementId)]),
    ])
    if (state === this.renderedState) return
    this.renderedState = state

    this.overlays.remove({ type: OUTCOME_OVERLAY })
    this.unmarkElements()
    for (const entry of decisions) this.showOutcomes(entry.decision)
    for (const entry of shown) this.markElement(entry)
    this.showCards(cards)
  }

  private hasDecision(element: DiagramElement): boolean {
    return new GatewayDecisionView(this.snapshot).shown.some(({ elementId }) => elementId === element.id)
  }

  private markElement({ elementId, decision }: DecisionLogEntry): void {
    const element = this.elementRegistry.get(elementId)
    if (!element) return
    this.canvas.addMarker(element, decision.stuckReason ? STUCK_MARKER : DECIDED_MARKER)
    this.markedElements.push(element)
  }

  private unmarkElements(): void {
    for (const element of this.markedElements) {
      this.canvas.removeMarker(element, DECIDED_MARKER)
      this.canvas.removeMarker(element, STUCK_MARKER)
    }
    this.markedElements = []
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
      const element = this.elementRegistry.get(entry.elementId)
      if (!element) return []
      const close = () => {
        this.pinnedElementIds.delete(entry.elementId)
        this.render()
      }
      const card = new DecisionCard(entry, this.pinnedElementIds.has(entry.elementId) ? close : undefined).element
      card.classList.add('bds-popover')
      card.dataset.elementId = entry.elementId
      return [{ element, card }]
    })
    this.popoverLayer.shadowRoot!.replaceChildren(...this.popovers.map(({ card }) => card))
    this.placePopovers()
  }

  private placePopovers(): void {
    const container = this.canvas.getContainer()
    const bounds = { width: container.clientWidth, height: container.clientHeight }
    for (const { element, card } of this.popovers) {
      card.style.maxHeight = ''
      const { left, top, maxHeight, hidden } = placePopover(
        this.canvas.getAbsoluteBBox(element),
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
