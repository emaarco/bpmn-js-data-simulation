import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const expectedFunctions = ['routeGateway', 'parseScenarios', 'resolveEngine', 'ScenarioError', 'DataSimulationStore']
const expectedEngines = ['zeebeEngine', 'camunda7Engine']

const esm = await import('../../dist/index.js')
const cjs = require('../../dist/index.cjs')

for (const [label, bundle] of [
  ['ESM', esm],
  ['CJS', cjs],
]) {
  for (const name of expectedFunctions) {
    assert.equal(typeof bundle[name], 'function', `${label} bundle is missing export "${name}"`)
  }
  for (const name of expectedEngines) {
    assert.equal(typeof bundle[name]?.evaluate, 'function', `${label} bundle is missing engine "${name}"`)
  }
  const module = bundle.default
  assert.ok(Array.isArray(module?.__init__), `${label} default export has no didi __init__`)
  for (const service of ['dataSimulation', 'dataGatewayBehaviors', 'dataGatewaySettings', 'dataContextPads']) {
    assert.ok(Array.isArray(module[service]), `${label} default export has no "${service}" service`)
  }
}

assert.ok(existsSync(new URL('../../dist/assets/bpmn-js-data-simulation.css', import.meta.url)), 'stylesheet missing')

console.log('distro smoke ok — engines, store and didi module present in ESM + CJS')
