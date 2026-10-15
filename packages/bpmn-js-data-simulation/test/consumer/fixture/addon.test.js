import DataSimulationModule, { zeebeEngine } from '@emaarco/bpmn-js-data-simulation'
import TokenSimulationModule from 'bpmn-js-token-simulation/lib/modeler'
import { expect, it } from 'vitest'

it('loads next to the token simulation without any test config', () => {
  expect(TokenSimulationModule.__depends__.length).toBeGreaterThan(0)
  expect(DataSimulationModule.__init__).toContain('dataSimulation')
  expect(zeebeEngine.evaluate('=orderTotal > 1000', { orderTotal: 1290 })).toEqual({ ok: true, value: true })
})
