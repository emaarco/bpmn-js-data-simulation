const assert = require('node:assert/strict')
const { PathSimulationModule } = require('@emaarco/bpmn-js-data-simulation')
const { Injector } = require('didi')

assert.throws(() => require.resolve('bpmn-js-token-simulation'), { code: 'MODULE_NOT_FOUND' })

const injector = new Injector([
  {
    elementRegistry: ['value', { get: () => undefined, filter: () => [] }],
    canvas: ['value', { addMarker() {}, removeMarker() {} }],
    'config.dataSimulation': ['value', { engine: 'camunda7' }],
  },
  PathSimulationModule,
])
assert.deepEqual(injector.get('pathSimulation').simulate({}), { taken: [], skipped: [], decisions: {}, measures: {} })
console.log('consumer without token simulation: CJS require ok')
