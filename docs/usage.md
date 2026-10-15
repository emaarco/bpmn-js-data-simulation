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

`parseFieldValue` and `formatFieldValue` are exported to convert between field input and variable values. The dialog renders in a shadow root, so page styles do not reach the container a renderer gets; a renderer brings its own styles, e.g. by adding a `<style>` to `container.getRootNode()`.

## Decision cards

A gateway that decided turns green, one the token is stuck at turns red. Each flow it evaluated gets a badge: ✓ taken, ✗ false, ! failed. Hovering the gateway or one of its flows opens a card with every condition, its result and the values of the variables it read, as they were when the gateway decided. Cards open only on demand, so they never hide the diagram on their own. They keep their size at any zoom and open below or above the gateway, wherever there is room, so they are never cut off at the edge of a small canvas; a stuck gateway's card names the reason first. Clicking the gateway keeps the card open until it is clicked again or closed, which helps when presenting. For a stuck gateway, the card also tells why. The cards show the decisions of the selected instance.

## Process Data

Like the simulation log, Process Data has a button in the token simulation palette (`{ }`, below the log) and opens a panel on the right; with both open, the log moves aside. The panel shows the variables of the selected instance and, when output mappings fail, their issues. It follows the newest instance; with several instances a picker appears. **Edit** changes the variables of a running instance, e.g. to fix a value a gateway got stuck on, then ▶ on the gateway evaluates it again.

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
```

The engine-neutral core is exported too (`routeGateway`, `parseScenarios`, `zeebeEngine`, `camunda7Engine`, `DataSimulationStore`), for tests or headless use.
