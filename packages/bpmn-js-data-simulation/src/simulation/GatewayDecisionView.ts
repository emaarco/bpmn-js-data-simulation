import type { DecisionLogEntry, SimulationSnapshot } from './DataSimulationStore.js'

export class GatewayDecisionView {
  readonly decisions: DecisionLogEntry[]
  readonly shown: DecisionLogEntry[]

  constructor(private readonly snapshot: SimulationSnapshot) {
    this.decisions = this.latestDecisionPerGateway()
    const shownPerGateway = new Map(this.decisions.map(entry => [entry.elementId, entry]))
    for (const entry of this.latestStuckDecisionPerGateway()) shownPerGateway.set(entry.elementId, entry)
    this.shown = [...shownPerGateway.values()]
  }

  private latestDecisionPerGateway(): DecisionLogEntry[] {
    const { log, selectedInstanceId } = this.snapshot
    const latest = new Map<string, DecisionLogEntry>()
    for (const entry of log) {
      if (entry.kind === 'decision' && entry.instanceId === selectedInstanceId) latest.set(entry.elementId, entry)
    }
    return [...latest.values()]
  }

  private latestStuckDecisionPerGateway(): DecisionLogEntry[] {
    const { instances, log } = this.snapshot
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
}
