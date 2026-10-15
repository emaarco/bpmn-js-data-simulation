import assert from 'node:assert/strict'
import DataSimulationModule, { zeebeEngine } from '@emaarco/bpmn-js-data-simulation'

assert.ok(DataSimulationModule.__init__.includes('dataSimulation'))
assert.deepEqual(zeebeEngine.evaluate('=1 + 1', {}), { ok: true, value: 2 })
console.log('consumer: ESM import ok')
