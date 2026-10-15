declare module 'bpmn-moddle' {
  export class BpmnModdle {
    constructor(packages?: Record<string, unknown>)
    fromXML(xml: string): Promise<{ rootElement: unknown; warnings: Array<{ message: string }> }>
  }
}

declare module 'bpmn-js-token-simulation/lib/simulator' {
  const SimulatorModule: Record<string, unknown>
  export default SimulatorModule
}

declare module 'bpmn-js-token-simulation/lib/features/context-pads' {
  const ContextPadsModule: Record<string, unknown>
  export default ContextPadsModule
}

declare module 'bpmn-js-token-simulation/lib/features/exclusive-gateway-settings' {
  const ExclusiveGatewaySettingsModule: Record<string, unknown>
  export default ExclusiveGatewaySettingsModule
}

declare module 'bpmn-js-token-simulation/lib/features/inclusive-gateway-settings' {
  const InclusiveGatewaySettingsModule: Record<string, unknown>
  export default InclusiveGatewaySettingsModule
}

declare module 'bpmn-js-token-simulation/lib/features/palette' {
  const PaletteModule: Record<string, unknown>
  export default PaletteModule
}

declare module 'bpmn-js-token-simulation/lib/features/toggle-mode/modeler' {
  const ToggleModeModule: Record<string, unknown>
  export default ToggleModeModule
}

declare module 'bpmn-js-token-simulation/lib/features/toggle-mode/viewer' {
  const ToggleModeModule: Record<string, unknown>
  export default ToggleModeModule
}

declare module 'bpmn-js-token-simulation/lib/features/context-pads/ContextPads' {
  export default class ContextPads {
    constructor(...dependencies: unknown[])
    _handlers: Array<{ handler: Record<string, unknown>; type: string }>
  }
}
