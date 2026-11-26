import type { SimulatedPath, Variables } from '../domain/model.js'
import { PathResolver } from '../domain/PathResolver.js'
import { EngineRegistry } from '../engines/EngineRegistry.js'
import type { EngineAdapter } from '../engines/types.js'
import type { DataSimulationConfig } from './DataSimulation.js'
import { PathGraphReader } from './PathGraphReader.js'
import { PathMarkers } from './PathMarkers.js'
import type { Canvas, ElementRegistry } from './tokenSimulation.js'

export type PathSimulationConfig = Pick<DataSimulationConfig, 'engine'>

export interface PathSimulationOptions {
  measures?: string[]
}

export class PathSimulation {
  static $inject = ['config.dataSimulation', 'elementRegistry', 'canvas']

  private readonly engine: EngineAdapter
  private readonly pathResolver = new PathResolver()
  private readonly pathGraphReader: PathGraphReader
  private readonly pathMarkers: PathMarkers

  constructor(config: PathSimulationConfig | undefined, elementRegistry: ElementRegistry, canvas: Canvas) {
    this.engine = new EngineRegistry().resolve(config?.engine ?? 'zeebe')
    this.pathGraphReader = new PathGraphReader(elementRegistry, this.engine)
    this.pathMarkers = new PathMarkers(canvas, elementRegistry)
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

  clear(): void {
    this.pathMarkers.clear()
  }
}
