import type { ConditionReads, NumberRange, PathVariable, Scenario, SimulatedPath, Variables } from '../domain/model.js'
import { PathResolver } from '../domain/PathResolver.js'
import { PathVariableDeriver } from '../domain/PathVariableDeriver.js'
import { EngineRegistry } from '../engines/EngineRegistry.js'
import type { EngineAdapter } from '../engines/types.js'
import type { DataSimulationConfig } from './DataSimulation.js'
import { PathGraphReader } from './PathGraphReader.js'
import { PathMarkers } from './PathMarkers.js'
import { ScenarioVariables } from './ScenarioVariables.js'
import type { Canvas, ElementRegistry } from './tokenSimulation.js'

export type PathSimulationConfig = Pick<DataSimulationConfig, 'engine'>

export interface PathSimulationOptions {
  measures?: string[]
}

export interface DeriveVariablesOptions {
  ranges?: Readonly<Record<string, Partial<NumberRange>>>
}

export class PathSimulation {
  static $inject = ['config.dataSimulation', 'elementRegistry', 'canvas']

  private readonly engine: EngineAdapter
  private readonly pathResolver = new PathResolver()
  private readonly pathVariableDeriver = new PathVariableDeriver()
  private readonly pathGraphReader: PathGraphReader
  private readonly pathMarkers: PathMarkers
  private readonly scenarioVariables: ScenarioVariables

  constructor(config: PathSimulationConfig | undefined, elementRegistry: ElementRegistry, canvas: Canvas) {
    this.engine = new EngineRegistry().resolve(config?.engine ?? 'zeebe')
    this.pathGraphReader = new PathGraphReader(elementRegistry, this.engine)
    this.pathMarkers = new PathMarkers(canvas, elementRegistry)
    this.scenarioVariables = new ScenarioVariables(elementRegistry, this.engine)
  }

  getEngine(): EngineAdapter {
    return this.engine
  }

  simulate(variables: Variables, options: PathSimulationOptions = {}): SimulatedPath {
    const graph = this.pathGraphReader.read(options.measures ?? [])
    const path = this.pathResolver.resolve(graph, expression => this.engine.evaluate(expression, variables))
    this.pathMarkers.show(path)
    return path
  }

  deriveVariables(values: Variables, options: DeriveVariablesOptions = {}): PathVariable[] {
    return this.pathVariableDeriver.derive(this.evaluableConditions(), values, options.ranges)
  }

  variablesOf(scenario: Scenario | undefined, fallbacks: readonly Scenario[] = []): Variables {
    return this.scenarioVariables.of(scenario, fallbacks)
  }

  clear(): void {
    this.pathMarkers.clear()
  }

  private evaluableConditions(): ConditionReads[] {
    return this.pathGraphReader
      .read([])
      .nodes.flatMap(node => node.outgoing.map(flow => flow.expression))
      .filter((expression): expression is string => expression !== undefined && this.engine.canEvaluate(expression))
      .map(expression => ({ expression, variableNames: this.engine.readVariableNames(expression) }))
  }
}
