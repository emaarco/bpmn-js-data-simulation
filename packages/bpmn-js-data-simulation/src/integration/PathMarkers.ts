import type { SimulatedPath } from '../domain/model.js'
import type { Canvas, DiagramElement, ElementRegistry } from './tokenSimulation.js'

const TAKEN_MARKER = 'bds-path--taken'
const SKIPPED_MARKER = 'bds-path--skipped'
const STUCK_MARKER = 'bds-path--stuck'

export class PathMarkers {
  private marked: Array<{ element: DiagramElement; marker: string }> = []

  constructor(
    private readonly canvas: Canvas,
    private readonly elementRegistry: ElementRegistry,
  ) {}

  show(path: SimulatedPath): void {
    this.clear()
    for (const id of path.taken) this.mark(id, TAKEN_MARKER)
    for (const id of path.skipped) this.mark(id, SKIPPED_MARKER)
    for (const [gatewayId, decision] of Object.entries(path.decisions)) {
      if (decision.stuckReason) this.mark(gatewayId, STUCK_MARKER)
    }
  }

  clear(): void {
    for (const { element, marker } of this.marked) this.canvas.removeMarker(element, marker)
    this.marked = []
  }

  private mark(id: string, marker: string): void {
    const element = this.elementRegistry.get(id)
    if (!element) return
    for (const markedElement of [element, ...(element.labels ?? [])]) {
      this.canvas.addMarker(markedElement, marker)
      this.marked.push({ element: markedElement, marker })
    }
  }
}
