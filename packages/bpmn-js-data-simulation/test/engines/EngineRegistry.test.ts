import { describe, expect, it } from 'vitest'
import { EngineRegistry } from '../../src/engines/EngineRegistry'
import { camunda7Engine, zeebeEngine } from '../../src/engines/engines'
import type { EngineAdapter } from '../../src/engines/types'

describe('EngineRegistry', () => {
  const registry = new EngineRegistry()

  it('resolves the built-in engines by id', () => {
    expect(registry.resolve('zeebe')).toBe(zeebeEngine)
    expect(registry.resolve('camunda7')).toBe(camunda7Engine)
  })

  it('passes a custom adapter through', () => {
    const custom = { id: 'zeebe' } as EngineAdapter
    expect(registry.resolve(custom)).toBe(custom)
  })

  it('rejects an unknown engine id', () => {
    expect(() => registry.resolve('flowable' as never)).toThrow(
      'Unknown engine "flowable", expected one of: zeebe, camunda7',
    )
  })
})
