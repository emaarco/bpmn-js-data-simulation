import { isVariables } from '../utils/variables.js'
import type { ElementVariableUsage, StartField, StartFieldHints, StartFieldType } from './model.js'

export class StartFieldDeriver {
  derive(usages: ElementVariableUsage[], { examples = [], taskResultNames = [] }: StartFieldHints = {}): StartField[] {
    const written = new Set([
      ...usages.flatMap(usage => usage.outputTargets.map(target => this.topLevelName(target))),
      ...taskResultNames,
    ])
    const usedBy = new Map<string, Set<string>>()

    for (const usage of usages) {
      const localNames = new Set(usage.inputTargets.map(target => this.topLevelName(target)))
      for (const name of [...usage.conditionReads, ...usage.inputReads, ...usage.outputReads]) {
        if (written.has(name) || localNames.has(name)) continue
        if (!usedBy.has(name)) usedBy.set(name, new Set())
        usedBy.get(name)!.add(usage.elementName)
      }
    }

    return [...usedBy.entries()].map(([name, elements]) => ({
      name,
      type: this.inferType(examples.map(example => example[name]).find(value => value !== undefined)),
      usedBy: [...elements],
    }))
  }

  private topLevelName(path: string): string {
    return path.split('.')[0]
  }

  private inferType(example: unknown): StartFieldType {
    if (typeof example === 'number') return 'number'
    if (typeof example === 'boolean') return 'boolean'
    if (typeof example === 'string') return 'text'
    if (Array.isArray(example) || isVariables(example)) return 'json'
    return 'auto'
  }
}
