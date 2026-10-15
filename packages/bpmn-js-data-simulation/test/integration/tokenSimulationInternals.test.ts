import SimulatorModule from 'bpmn-js-token-simulation/lib/simulator'
import ContextPadsModule from 'bpmn-js-token-simulation/lib/features/context-pads'
import ContextPads from 'bpmn-js-token-simulation/lib/features/context-pads/ContextPads'
import ExclusiveGatewaySettingsModule from 'bpmn-js-token-simulation/lib/features/exclusive-gateway-settings'
import InclusiveGatewaySettingsModule from 'bpmn-js-token-simulation/lib/features/inclusive-gateway-settings'
import PaletteModule from 'bpmn-js-token-simulation/lib/features/palette'
import ModelerToggleModeModule from 'bpmn-js-token-simulation/lib/features/toggle-mode/modeler'
import ViewerToggleModeModule from 'bpmn-js-token-simulation/lib/features/toggle-mode/viewer'
import { describe, expect, it } from 'vitest'

type ServiceDefinition = ['type', { prototype: Record<string, unknown> }]

function service(module: Record<string, unknown>, name: string): ServiceDefinition | undefined {
  if (module[name]) return module[name] as ServiceDefinition
  for (const dependency of (module.__depends__ ?? []) as Array<Record<string, unknown>>) {
    const found = service(dependency, name)
    if (found) return found
  }
  return undefined
}

describe('token simulation internals this add-on hooks into', () => {
  it.each([
    [SimulatorModule, 'exclusiveGatewayBehavior', ['exit']],
    [SimulatorModule, 'inclusiveGatewayBehavior', ['exit']],
    [ExclusiveGatewaySettingsModule, 'exclusiveGatewaySettings', ['setSequenceFlow']],
    [InclusiveGatewaySettingsModule, 'inclusiveGatewaySettings', ['_setGatewayDefaults', 'toggleSequenceFlow']],
    [ContextPadsModule, 'contextPads', []],
    [PaletteModule, 'tokenSimulationPalette', ['addEntry']],
    [ModelerToggleModeModule, 'toggleMode', ['toggleMode']],
    [ViewerToggleModeModule, 'toggleMode', ['toggleMode']],
  ] as const)('%#: the service "%s" exists with its methods', (module, name, methods) => {
    const [, type] = service(module, name)!
    for (const method of methods) expect(typeof type.prototype[method]).toBe('function')
  })

  it('keeps the context pad handlers with the element type they are registered for', () => {
    const injector = { instantiate: (Handler: new () => unknown) => new Handler() }
    const contextPads = new ContextPads({ on() {} }, {}, {}, injector, {}, {})

    const types = contextPads._handlers.map(({ type }) => type)
    expect(types).toEqual(expect.arrayContaining(['bpmn:ExclusiveGateway', 'bpmn:InclusiveGateway', 'bpmn:Event']))
    for (const { handler } of contextPads._handlers) expect(typeof handler.createContextPads).toBe('function')
  })
})
