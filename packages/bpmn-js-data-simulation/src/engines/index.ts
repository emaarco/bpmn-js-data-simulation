import { camunda7Engine } from './camunda7/camunda7Engine.js'
import type { EngineAdapter, EngineId } from './types.js'
import { zeebeEngine } from './zeebe/zeebeEngine.js'

const ENGINES: Record<EngineId, EngineAdapter> = {
  zeebe: zeebeEngine,
  camunda7: camunda7Engine,
}

export function resolveEngine(engine: EngineId | EngineAdapter): EngineAdapter {
  if (typeof engine !== 'string') return engine
  const adapter = ENGINES[engine]
  if (!adapter) {
    throw new Error(`Unknown engine "${engine}", expected one of: ${Object.keys(ENGINES).join(', ')}`)
  }
  return adapter
}

export { camunda7Engine, zeebeEngine }
export type { EngineAdapter, EngineId }
