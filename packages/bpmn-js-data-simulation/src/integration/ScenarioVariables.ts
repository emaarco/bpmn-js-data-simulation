import type { Scenario, Variables } from '../domain/model.js'
import type { EngineAdapter } from '../engines/types.js'
import { flowNodesOf } from '../utils/diagramElements.js'
import type { ElementRegistry } from './tokenSimulation.js'

export class ScenarioVariables {
  constructor(
    private readonly elementRegistry: ElementRegistry,
    private readonly engine: EngineAdapter,
  ) {}

  of(scenario: Scenario | undefined, fallbacks: readonly Scenario[]): Variables {
    const fallbackVariables = fallbacks.map(fallback => this.afterOutputMappings(fallback))
    return Object.assign({}, ...fallbackVariables, this.afterOutputMappings(scenario))
  }

  private afterOutputMappings(scenario: Scenario | undefined): Variables {
    let variables: Variables = Object.assign({}, scenario?.variables, ...Object.values(scenario?.taskResults ?? {}))
    for (const flowNode of flowNodesOf(this.elementRegistry)) {
      for (const { source, target } of this.engine.readIoMappings(flowNode.businessObject).outputs) {
        const evaluation = this.engine.evaluate(source, variables)
        if (evaluation.ok) variables = this.engine.writeVariable(variables, target, evaluation.value)
      }
    }
    return variables
  }
}
