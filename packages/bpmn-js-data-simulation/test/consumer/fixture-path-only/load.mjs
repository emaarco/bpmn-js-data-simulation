import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { PathSimulationModule } from '@emaarco/bpmn-js-data-simulation'
import { Injector } from 'didi'

assert.throws(() => createRequire(import.meta.url).resolve('bpmn-js-token-simulation'), { code: 'MODULE_NOT_FOUND' })

const injector = new Injector([
  {
    elementRegistry: ['value', { get: () => undefined, filter: () => [] }],
    canvas: ['value', { addMarker() {}, removeMarker() {} }],
    'config.dataSimulation': ['value', { engine: 'zeebe' }],
  },
  PathSimulationModule,
])
assert.deepEqual(injector.get('pathSimulation').simulate({}), { taken: [], skipped: [], decisions: {}, measures: {} })
console.log('consumer without token simulation: ESM import ok')
