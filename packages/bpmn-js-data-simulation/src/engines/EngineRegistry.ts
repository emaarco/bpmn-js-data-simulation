import { camunda7Engine, zeebeEngine } from './engines.js'
import type { EngineAdapter, EngineId } from './types.js'

export class EngineRegistry {
  private readonly engines: Record<EngineId, EngineAdapter> = {
    zeebe: zeebeEngine,
    camunda7: camunda7Engine,
  }

  resolve(engine: EngineId | EngineAdapter): EngineAdapter {
    if (typeof engine !== 'string') return engine
    const adapter = this.engines[engine]
    if (!adapter) {
      throw new Error(`Unknown engine "${engine}", expected one of: ${Object.keys(this.engines).join(', ')}`)
    }
    return adapter
  }
}
