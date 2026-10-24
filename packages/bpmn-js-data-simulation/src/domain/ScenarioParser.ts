import { isVariables } from '../utils/variables.js'
import type { Scenario, Variables } from './model.js'
import { ScenarioError } from './ScenarioError.js'

export class ScenarioParser {
  parse(input: unknown): Scenario[] {
    const list = isVariables(input) ? input.scenarios : input
    if (!Array.isArray(list)) {
      throw new ScenarioError('Expected an array of scenarios or an object with a "scenarios" array')
    }
    const scenarios = list.map((raw, index) => this.parseScenario(raw, index))
    this.assertUniqueIds(scenarios)
    return scenarios
  }

  private parseScenario(raw: unknown, index: number): Scenario {
    if (!isVariables(raw)) {
      throw new ScenarioError(`Scenario #${index + 1} must be an object`)
    }
    const { id, name, description, variables = {}, taskResults = {} } = raw
    const label = typeof id === 'string' ? `"${id}"` : `#${index + 1}`

    if (typeof id !== 'string' || !id) {
      throw new ScenarioError(`Scenario ${label} needs a non-empty string "id"`)
    }
    if (name !== undefined && typeof name !== 'string') {
      throw new ScenarioError(`Scenario ${label}: "name" must be a string`)
    }
    if (description !== undefined && typeof description !== 'string') {
      throw new ScenarioError(`Scenario ${label}: "description" must be a string`)
    }
    if (!isVariables(variables)) {
      throw new ScenarioError(`Scenario ${label}: "variables" must be an object`)
    }
    if (!isVariables(taskResults) || !Object.values(taskResults).every(isVariables)) {
      throw new ScenarioError(`Scenario ${label}: "taskResults" must map element ids to objects`)
    }

    return {
      id,
      name: name ?? id,
      ...(description === undefined ? {} : { description }),
      variables,
      taskResults: taskResults as Record<string, Variables>,
    }
  }

  private assertUniqueIds(scenarios: Scenario[]): void {
    const seen = new Set<string>()
    for (const { id } of scenarios) {
      if (seen.has(id)) {
        throw new ScenarioError(`Duplicate scenario id "${id}"`)
      }
      seen.add(id)
    }
  }
}
