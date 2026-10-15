import type { GatewayKind, RoutingDecision, Variables } from '../domain/model.js'
import type { Scenario } from '../domain/scenario.js'

export type InstanceStatus = 'running' | 'waiting' | 'completed'

export interface WaitingGateway {
  scopeId: string
  gatewayId: string
  gatewayName: string
}

export interface InstanceState {
  id: string
  number: number
  processName: string
  scenarioId: string | null
  status: InstanceStatus
  variables: Variables
  waiting: WaitingGateway[]
}

interface LogEntryBase {
  id: number
  instanceId: string
  elementId: string
  elementName: string
}

export interface ConditionInput {
  name: string
  value: unknown
}

export interface DecisionLogEntry extends LogEntryBase {
  kind: 'decision'
  gatewayKind: GatewayKind
  chosenBy: 'data' | 'click'
  decision: RoutingDecision
  inputs: ConditionInput[]
}

export interface MappingIssueLogEntry extends LogEntryBase {
  kind: 'mapping-issue'
  target: string
  reason: string
}

export type LogEntry = DecisionLogEntry | MappingIssueLogEntry

type NewLogEntry = Omit<DecisionLogEntry, 'id'> | Omit<MappingIssueLogEntry, 'id'>

export interface SimulationSnapshot {
  engineLabel: string
  expressionLanguage: string
  scenarios: Scenario[]
  selectedScenarioId: string | null
  startVariables: Variables
  instances: InstanceState[]
  selectedInstanceId: string | null
  log: LogEntry[]
}

export type SimulationListener = (snapshot: SimulationSnapshot) => void

export class DataSimulationStore {
  private engineLabel = ''
  private expressionLanguage = ''
  private scenarios: Scenario[] = []
  private selectedScenarioId: string | null = null
  private startVariables: Variables = {}
  private readonly instances = new Map<string, InstanceState>()
  private selectedInstanceId: string | null = null
  private log: LogEntry[] = []
  private nextLogId = 1
  private readonly listeners = new Set<SimulationListener>()

  setEngine(label: string, expressionLanguage: string): void {
    this.engineLabel = label
    this.expressionLanguage = expressionLanguage
    this.emit()
  }

  setScenarios(scenarios: Scenario[]): void {
    this.scenarios = scenarios
    this.selectScenario(scenarios[0]?.id ?? null)
  }

  selectScenario(scenarioId: string | null): void {
    const scenario = this.scenarios.find(candidate => candidate.id === scenarioId)
    this.selectedScenarioId = scenario?.id ?? null
    this.startVariables = scenario ? structuredClone(scenario.variables) : {}
    this.emit()
  }

  setStartVariables(variables: Variables): void {
    this.startVariables = structuredClone(variables)
    this.emit()
  }

  startInstance(id: string, processName: string): void {
    this.instances.set(id, {
      id,
      number: this.instances.size + 1,
      processName,
      scenarioId: this.selectedScenarioId,
      status: 'running',
      variables: structuredClone(this.startVariables),
      waiting: [],
    })
    this.selectedInstanceId = id
    this.emit()
  }

  selectInstance(instanceId: string): void {
    if (!this.instances.has(instanceId)) return
    this.selectedInstanceId = instanceId
    this.emit()
  }

  completeInstance(id: string): void {
    this.updateInstance(id, instance => ({ ...instance, status: 'completed', waiting: [] }))
  }

  hasInstance(id: string): boolean {
    return this.instances.has(id)
  }

  getTaskResult(instanceId: string, elementId: string): Variables | undefined {
    const scenarioId = this.instances.get(instanceId)?.scenarioId
    return this.scenarios.find(scenario => scenario.id === scenarioId)?.taskResults[elementId]
  }

  getVariables(instanceId: string): Variables {
    return this.instances.get(instanceId)?.variables ?? {}
  }

  setVariables(instanceId: string, variables: Variables): void {
    this.updateInstance(instanceId, instance => ({ ...instance, variables: structuredClone(variables) }))
  }

  addWaiting(instanceId: string, waiting: WaitingGateway): void {
    this.updateInstance(instanceId, instance => ({ ...instance, waiting: [...instance.waiting, waiting] }))
  }

  removeWaiting(scopeId: string): void {
    const instance = [...this.instances.values()].find(candidate =>
      candidate.waiting.some(waiting => waiting.scopeId === scopeId),
    )
    if (!instance) return
    this.updateInstance(instance.id, current => ({
      ...current,
      waiting: current.waiting.filter(waiting => waiting.scopeId !== scopeId),
    }))
  }

  record(entry: NewLogEntry): void {
    this.log = [...this.log, { ...entry, id: this.nextLogId++ } as LogEntry]
    this.emit()
  }

  reset(): void {
    this.instances.clear()
    this.selectedInstanceId = null
    this.log = []
    this.emit()
  }

  getSnapshot(): SimulationSnapshot {
    return {
      engineLabel: this.engineLabel,
      expressionLanguage: this.expressionLanguage,
      scenarios: this.scenarios,
      selectedScenarioId: this.selectedScenarioId,
      startVariables: this.startVariables,
      instances: [...this.instances.values()].map(withStatus),
      selectedInstanceId: this.selectedInstanceId,
      log: this.log,
    }
  }

  subscribe(listener: SimulationListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private updateInstance(id: string, update: (instance: InstanceState) => InstanceState): void {
    const instance = this.instances.get(id)
    if (!instance) return
    this.instances.set(id, update(instance))
    this.emit()
  }

  private emit(): void {
    const snapshot = this.getSnapshot()
    for (const listener of [...this.listeners]) listener(snapshot)
  }
}

function withStatus(instance: InstanceState): InstanceState {
  if (instance.status === 'completed') return instance
  return { ...instance, status: instance.waiting.length ? 'waiting' : 'running' }
}
