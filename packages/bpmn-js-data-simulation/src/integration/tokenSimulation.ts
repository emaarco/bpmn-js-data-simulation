import type { ModdleElement } from '../engines/types.js'

export const TOGGLE_MODE_EVENT = 'tokenSimulation.toggleMode'
export const RESET_SIMULATION_EVENT = 'tokenSimulation.resetSimulation'
export const SCOPE_CREATE_EVENT = 'tokenSimulation.simulator.createScope'
export const SCOPE_DESTROYED_EVENT = 'tokenSimulation.simulator.destroyScope'
export const TRACE_EVENT = 'tokenSimulation.simulator.trace'
export const DATA_TOGGLE_EVENT = 'dataSimulation.toggle'

export interface DiagramElement {
  id: string
  type: string
  businessObject: ModdleElement
  outgoing?: DiagramElement[]
  waypoints?: Array<{ x: number; y: number }>
  width?: number
  height?: number
  parent?: DiagramElement
  children?: DiagramElement[]
  source?: DiagramElement
}

export interface Scope {
  id: string
  element: DiagramElement
  parent: Scope | null
  failed: boolean
  canceled: boolean
  start(): Scope
}

export interface BehaviorContext {
  element: DiagramElement
  scope: Scope
  initiator?: Scope
}

interface SimulatorEvent {
  element: DiagramElement
  type: string
  interrupting: boolean
  boundary: boolean
}

interface Subscription {
  remove(): void
}

export interface Simulator {
  createScope(context: { element: DiagramElement; parent: Scope | null; initiator?: Scope }): Scope
  subscribe(scope: Scope, event: SimulatorEvent, triggerFn: (initiator?: Scope) => unknown): Subscription
  enter(context: { element: DiagramElement; scope: Scope | null; initiator?: Scope }): Scope
  exit(context: BehaviorContext): void
  getConfig(element: DiagramElement): { activeOutgoing?: DiagramElement | DiagramElement[] }
}

export interface EventBus {
  on(event: string | string[], callback: (event: any) => unknown): void
  fire(event: string, payload: object): void
}

export interface Overlays {
  add(
    element: DiagramElement,
    type: string,
    overlay: { position: Record<string, number>; scale?: { min?: number; max?: number }; html: HTMLElement },
  ): string
  remove(filter: string | { type?: string; element?: DiagramElement }): void
}

export interface Canvas {
  getContainer(): HTMLElement
  getAbsoluteBBox(element: DiagramElement): { x: number; y: number; width: number; height: number }
  addMarker(element: DiagramElement, marker: string): void
  removeMarker(element: DiagramElement, marker: string): void
}

export interface ElementRegistry {
  get(id: string): DiagramElement | undefined
}

export function findProcessInstance(scope: Scope): Scope {
  let current = scope
  while (current.parent) current = current.parent
  return current
}

export function elementName(element: DiagramElement): string {
  const name = element.businessObject.name
  return typeof name === 'string' && name.trim() ? name.trim() : element.id
}

export function is(element: DiagramElement, type: string): boolean {
  const businessObject = element.businessObject as { $instanceOf?: (type: string) => boolean }
  return typeof businessObject?.$instanceOf === 'function' && businessObject.$instanceOf(type)
}
