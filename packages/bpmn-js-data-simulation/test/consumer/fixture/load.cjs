const assert = require('node:assert/strict')
const { default: DataSimulationModule, camunda7Engine } = require('@emaarco/bpmn-js-data-simulation')

assert.ok(DataSimulationModule.__init__.includes('dataSimulation'))
assert.deepEqual(camunda7Engine.evaluate('${1 + 1}', {}), { ok: true, value: 2 })
console.log('consumer: CJS require ok')
