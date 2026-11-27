# Usage

## Set up the modeler

Register the module next to the token simulation and pass the moddle extension of your engine, so the mappings can be read:

```ts
import BpmnModeler from 'bpmn-js/lib/Modeler'
import TokenSimulationModule from 'bpmn-js-token-simulation'
import DataSimulationModule, { type DataSimulation, type DataSimulationConfig } from '@emaarco/bpmn-js-data-simulation'
import zeebeModdle from 'zeebe-bpmn-moddle/resources/zeebe.json'

import 'bpmn-js-token-simulation/assets/css/bpmn-js-token-simulation.css'
import '@emaarco/bpmn-js-data-simulation/assets/bpmn-js-data-simulation.css'

const modeler = new BpmnModeler({
  container: '#canvas',
  additionalModules: [TokenSimulationModule, DataSimulationModule],
  moddleExtensions: { zeebe: zeebeModdle },
  dataSimulation: {
    engine: 'zeebe',
    scenarios: await fetch('/order.scenarios.json').then(response => response.json()),
  } satisfies DataSimulationConfig,
})

await modeler.importXML(bpmnXml)
```

bpmn-js types its options as `Record<string, any>` beyond the built-in ones, so `satisfies DataSimulationConfig` is what checks the `dataSimulation` block.

It works the same with a viewer: use `bpmn-js/lib/NavigatedViewer` and `bpmn-js-token-simulation/lib/viewer`. For Camunda 7, pass `camunda-bpmn-moddle` and `engine: 'camunda7'`.

The engine is chosen once, because the modeler needs the matching moddle extension anyway. To switch engines, create a new modeler.

## Switching it off

In simulation mode, a **Data Simulation** switch sits next to the token simulation's own. Turned off, the add-on steps aside: gateways are chosen by click again, ▶ starts without the dialog, and no variables or decisions are tracked. Switching resets the running simulation, just like switching the token simulation. `dataSimulation: { enabled: false }` starts with it off; `dataSimulation.setEnabled(enabled)` and `isEnabled()` switch it from code.

## Start dialog

In simulation mode, ▶ on a start event opens the start dialog.

- **Fields:** every variable that a condition or an input or output mapping of the process reads, and that no output mapping writes. Task results of the chosen scenario are left out; with **No scenario**, the dialog asks for them too, so a process can run from scratch.
- **Field types:** number, checkbox, text or JSON, taken from the scenario values. Each field shows where the variable is used.
- **Scenario:** picking one prefills the fields; any value can be changed before the start.
- **Empty fields** leave the variable unset, a quick way to see a condition fail.

The form renderer is pluggable. The default is a lightweight DOM form; pass your own `StartFormRenderer` to use another form library, e.g. [form-js](https://github.com/bpmn-io/form-js):

```ts
new BpmnModeler({
  // …
  dataSimulation: { engine: 'zeebe', startFormRenderer: myRenderer },
})
```

`StartFieldCodec` is exported to convert between field input and variable values (`parse`, `format`). The dialog renders in a shadow root, so page styles do not reach the container a renderer gets; a renderer brings its own styles, e.g. by adding a `<style>` to `container.getRootNode()`.

## Decision cards

A gateway that decided turns green, one the token is stuck at turns red; so does an activity that routes by [conditions on its outgoing flows](engines.md#conditional-flows-on-activities). Each flow it evaluated gets a badge: ✓ taken, ✗ false, ! failed. Hovering the gateway or one of its flows opens a card with every condition, its result and the values of the variables it read, as they were when the gateway decided. Cards open only on demand, so they never hide the diagram on their own. They keep their size at any zoom and open below or above the gateway, wherever there is room, so they are never cut off at the edge of a small canvas; a stuck gateway's card names the reason first. Clicking the gateway keeps the card open until it is clicked again or closed, which helps when presenting. For a stuck gateway, the card also tells why. The cards show the decisions of the selected instance.

## Process Data

Like the simulation log, Process Data has a button in the token simulation palette (`{ }`, below the log) and opens a panel on the right; with both open, the log moves aside. The panel shows the variables of the selected instance and, when output mappings fail, their issues. It follows the newest instance; with several instances a picker appears. **Edit** changes the variables of a running instance, e.g. to fix a value a gateway got stuck on, then ▶ on the gateway evaluates it again.

## Path simulation (what-if)

`pathSimulation.simulate(variables)` answers "which way does it go for this data?" without a token or an instance: the gateways decide right away and the path is marked on the diagram. It is meant for outside simulation mode, e.g. a slide with a slider or a docs page with a viewer.

`PathSimulationModule` needs no token simulation, so a plain viewer is enough:

```ts
import NavigatedViewer from 'bpmn-js/lib/NavigatedViewer'
import { PathSimulationModule, type PathSimulation } from '@emaarco/bpmn-js-data-simulation'
import zeebeModdle from 'zeebe-bpmn-moddle/resources/zeebe.json'

import '@emaarco/bpmn-js-data-simulation/assets/bpmn-js-data-simulation.css'

const viewer = new NavigatedViewer({
  container: '#canvas',
  additionalModules: [PathSimulationModule],
  moddleExtensions: { zeebe: zeebeModdle },
  dataSimulation: { engine: 'zeebe' }, // only `engine` is read; optional, default 'zeebe'
})
await viewer.importXML(bpmnXml)

const pathSimulation = viewer.get<PathSimulation>('pathSimulation')
slider.addEventListener('input', () => {
  const { taken, skipped, decisions } = pathSimulation.simulate({
    orderTotal: slider.valueAsNumber,
    creditworthy: true,
  })
  console.log(decisions.gateway_credit.takenFlowIds) // ['flow_review']
})
```

`DataSimulationModule` already includes it: with the modeler set up as above, `modeler.get('pathSimulation')` is there too and uses the same engine. The add-on does not clear the path when simulation mode is switched on; call `clear()` from your own UI, as the [example](../packages/example/src/WhatIfPanel.ts) does.

- **Same evaluation as the simulation:** FEEL or JUEL conditions of the selected engine, default flows, first true flow for exclusive gateways, every true flow for inclusive ones and for [conditional flows on activities](engines.md#conditional-flows-on-activities).
- **Path:** it starts at the process's start events, enters sub-processes, and follows every outgoing flow of anything that is no exclusive or inclusive gateway and no activity with conditional flows. Boundary events and event sub-processes are not on the path. Mappings and task results are not applied, so pass every variable the conditions read, e.g. from `variablesOf`.
- **Result:** a `SimulatedPath`. `taken` and `skipped` list the ids of flow nodes and sequence flows, `decisions` holds the `RoutingDecision` of every gateway and activity that routes by its flows on the path, with `stuckReason` when it cannot decide (and `refusedByEngine` when the engine would reject the model). When it is stuck only because variables its conditions read are not set, `missingVariables` names them: the gateway waits for data rather than failing, so a host can start from no data and let the path grow as values are set. Nothing behind such a gateway is taken.
- **Markers:** `bds-path--taken` and `bds-path--skipped` on every element (and its label), `bds-path--stuck` on a gateway that cannot decide, but not on one that only waits for `missingVariables`. Skipped elements fade, taken ones are drawn in the accent colour; tune it with `--bds-path-taken` and `--bds-path-skipped-opacity`, or style the markers yourself. `clear()` removes them.
- **Measures:** `simulate(variables, { measures: ['sim:duration'] })` sums numeric attributes of the elements on the path, e.g. a lead time, in `measures`. Declare the attribute's namespace in the diagram (`xmlns:sim="…"` and `<bpmn:task sim:duration="2">`); elements without it count as 0.
- **Controls:** `deriveVariables(values)` lists every variable the evaluable conditions read as a `PathVariable`, so a host renders its sliders and switches from the diagram instead of hard-coding them. `type` follows the current value: `boolean`, `number`, `text` (a string) or `json` (lists and objects). A variable without a value is typed by how the conditions use it: `number` when one compares it with a number (`orderTotal <= 5000`, `${score ge 70}`) or with `<`, `<=`, `>` or `>=` (`screeningScore >= minimumScore`), `boolean` when one uses it as a condition of its own (`approved`, `not(approved)`, `${!hire}`, `insured == true`), else `text`. A `number` carries a `range` for a slider: from 0 to the larger of the value and twice the numbers the conditions compare it with (literals, and the values of the other variables they read), rounded up to 1, 2 or 5 times a power of ten, in 100 steps. A slider dragged to its end keeps its range when the host derives the variables again, so a host may derive them on every change. Set the bounds yourself with `deriveVariables(values, { ranges: { orderTotal: { min: 0, max: 8000 } } })`; `min`, `max` and `step` are each optional, and a missing `step` divides the range into 100.
- **Values from a scenario:** `variablesOf(scenario, fallbacks)` gives the scenario's variables and task results after the output mappings of the diagram, e.g. a `creditworthy` computed from a task's `score`. Pass the other scenarios as `fallbacks` to fill in what the scenario lacks; the scenario wins. Without a scenario it returns what the fallbacks give.

```ts
const { scenarios } = dataSimulation.getSnapshot()
const values = pathSimulation.variablesOf(scenarios[0], scenarios)

for (const variable of pathSimulation.deriveVariables(values)) {
  if (variable.type === 'number') renderSlider(variable.name, variable.range) // { min: 0, max: 10000, step: 100 }
  if (variable.type === 'boolean') renderSwitch(variable.name)
}
pathSimulation.simulate(values)
```

## Styling

The add-on renders its panel, dialog, cards and badges in shadow roots, so the styles of the page around it (a slide theme, a CMS) cannot change them. Adjust them through the CSS variables instead: `--bds-*` from the add-on's stylesheet and `--token-simulation-*` from the token simulation. The start dialog is attached to `document.body`, so it stays fully visible even on a small canvas.

## API

```ts
const dataSimulation = modeler.get<DataSimulation>('dataSimulation')

dataSimulation.setScenarios(scenarioFile) // validates, throws a ScenarioError
dataSimulation.selectScenario('small-order') // preselected in the start dialog
dataSimulation.setStartVariables({ orderTotal: 9000 }) // prefilled in the start dialog
dataSimulation.selectInstance(instanceId)
dataSimulation.setInstanceVariables(instanceId, { orderTotal: 450 })
dataSimulation.setEnabled(false) // back to the plain token simulation
dataSimulation.subscribe(snapshot => console.log(snapshot.instances, snapshot.log))

const pathSimulation = modeler.get<PathSimulation>('pathSimulation')

pathSimulation.simulate({ orderTotal: 9000 }) // what-if: the path for these variables, marked on the diagram
pathSimulation.clear()
pathSimulation.getEngine() // the engine adapter, shared with dataSimulation
pathSimulation.deriveVariables({ orderTotal: 9000 }, { ranges: { orderTotal: { max: 20000 } } }) // the variables the conditions read, typed for a control
pathSimulation.variablesOf(scenario, otherScenarios) // a scenario's variables after the output mappings
```

The engine-neutral core is exported too (`GatewayRouter`, `ScenarioParser`, `ZeebeEngine`, `Camunda7Engine` and their ready-made instances `zeebeEngine` and `camunda7Engine`, `EngineRegistry`, `DataSimulationStore`), for tests or headless use.
