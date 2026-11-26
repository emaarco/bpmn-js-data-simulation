import type { EngineAdapter, ModdleElement, Scenario, Variables } from '@emaarco/bpmn-js-data-simulation'
import { niceCeiling, numberLiterals } from './utils/niceNumbers'

export interface DiagramElement {
  id: string
  type: string
  businessObject: ModdleElement & { $instanceOf(type: string): boolean }
}

export interface ElementRegistry {
  get(id: string): DiagramElement | undefined
  filter(predicate: (element: DiagramElement) => boolean): DiagramElement[]
}

export type WhatIfControl =
  { kind: 'boolean' } | { kind: 'number'; min: number; max: number; step: number } | { kind: 'text' } | { kind: 'json' }

export interface WhatIfField {
  name: string
  control: WhatIfControl
}

const RANGE_STEPS = 100

export class WhatIfFields {
  constructor(
    private readonly elementRegistry: ElementRegistry,
    private readonly engine: EngineAdapter,
  ) {}

  derive(values: Variables): WhatIfField[] {
    const conditions = this.evaluableConditions()
    const names = [...new Set(conditions.flatMap(condition => this.engine.readVariableNames(condition)))]
    return names.map(name => ({ name, control: this.controlFor(values[name], this.literalsNear(name, conditions)) }))
  }

  prefill(scenario: Scenario | undefined, otherScenarios: Scenario[]): Variables {
    const fallbacks = otherScenarios.map(other => this.variablesAfter(other))
    return { ...Object.assign({}, ...fallbacks), ...this.variablesAfter(scenario) }
  }

  private variablesAfter(scenario: Scenario | undefined): Variables {
    let variables: Variables = {
      ...scenario?.variables,
      ...Object.assign({}, ...Object.values(scenario?.taskResults ?? {})),
    }
    for (const element of this.flowNodes()) {
      for (const { source, target } of this.engine.readIoMappings(element.businessObject).outputs) {
        const evaluation = this.engine.evaluate(source, variables)
        if (evaluation.ok) variables = this.engine.writeVariable(variables, target, evaluation.value)
      }
    }
    return variables
  }

  private controlFor(value: unknown, literals: number[]): WhatIfControl {
    if (typeof value === 'boolean') return { kind: 'boolean' }
    if (typeof value === 'number') {
      const max = niceCeiling(2 * Math.max(Math.abs(value), ...literals))
      return { kind: 'number', min: 0, max, step: max / RANGE_STEPS }
    }
    if (value === undefined || typeof value === 'string') return { kind: 'text' }
    return { kind: 'json' }
  }

  private literalsNear(name: string, conditions: string[]): number[] {
    return conditions
      .filter(condition => this.engine.readVariableNames(condition).includes(name))
      .flatMap(condition => numberLiterals(condition))
  }

  private evaluableConditions(): string[] {
    return this.elementRegistry
      .filter(element => element.type === 'bpmn:SequenceFlow')
      .map(flow => this.engine.readCondition(flow.businessObject))
      .filter((condition): condition is string => condition !== undefined && this.engine.canEvaluate(condition))
  }

  private flowNodes(): DiagramElement[] {
    return this.elementRegistry.filter(
      element => element.id === element.businessObject.id && element.businessObject.$instanceOf('bpmn:FlowNode'),
    )
  }
}
