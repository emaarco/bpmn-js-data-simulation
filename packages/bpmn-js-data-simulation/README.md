# @emaarco/bpmn-js-data-simulation

[![npm version](https://img.shields.io/npm/v/@emaarco/bpmn-js-data-simulation.svg)](https://www.npmjs.com/package/@emaarco/bpmn-js-data-simulation)
[![CI](https://github.com/emaarco/bpmn-js-data-simulation/actions/workflows/ci.yml/badge.svg)](https://github.com/emaarco/bpmn-js-data-simulation/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/emaarco/bpmn-js-data-simulation/blob/main/LICENSE)

An add-on for [bpmn-js-token-simulation](https://github.com/bpmn-io/bpmn-js-token-simulation) that runs BPMN
processes **with data**: start variables, io mappings and gateway conditions, evaluated the way the
engine would. No running engine, no clicking the path by hand.

![Starting a Zeebe process with a scenario, hovering gateways to see why they took their flow, and fixing a missing variable to continue a stuck token](https://raw.githubusercontent.com/emaarco/bpmn-js-data-simulation/main/docs/screenshots/simulation.gif)

## Why

The token simulation shows which paths a process _can_ take. Gateways pick their flow by click, and
conditions, default flows and io mappings are ignored. That explains BPMN, but not _why_ a process
takes a path, and checking a condition still needs a deployed process and a running engine.

bpmn-js-data-simulation evaluates what the process is modeled with:

- **Shows why a path is taken.** Gateways that decided turn green; hover one and a card lists its
  conditions, their results and the values they read. Click the gateway to keep the card open.
- **What-if on the spot.** Start an instance from a scenario, change any value in the start dialog,
  or edit the variables of a running instance.
- **Behaves like the engine.** Zeebe conditions and mappings are FEEL, Camunda 7 ones JUEL, with
  each engine's rules for task results and variables.
- **Fails visibly.** When no flow matches or a condition fails, the token stops at the gateway and
  it turns red, as an incident would; its card tells why. Fix the data and continue.
- **Drop-in.** One more module next to the token simulation, in any bpmn-js modeler or viewer. A
  **Data Simulation** switch next to the token simulation's own turns it off for the plain click-through.

## Install

```
npm install @emaarco/bpmn-js-data-simulation
```

`bpmn-js` (>= 18) and `bpmn-js-token-simulation` (`1.0.0`, pinned) are peer dependencies.

## Quick start

```ts
import BpmnModeler from 'bpmn-js/lib/Modeler'
import TokenSimulationModule from 'bpmn-js-token-simulation'
import DataSimulationModule from '@emaarco/bpmn-js-data-simulation'
import zeebeModdle from 'zeebe-bpmn-moddle/resources/zeebe.json'
import 'bpmn-js-token-simulation/assets/css/bpmn-js-token-simulation.css'
import '@emaarco/bpmn-js-data-simulation/assets/bpmn-js-data-simulation.css'

const modeler = new BpmnModeler({
  container: '#canvas',
  additionalModules: [TokenSimulationModule, DataSimulationModule],
  moddleExtensions: { zeebe: zeebeModdle },
  dataSimulation: { engine: 'zeebe', scenarios },
})
```

Switch on the token simulation and press ▶ on a start event: a dialog asks for the start variables
the process reads, prefilled from a scenario. The [demo](https://emaarco.github.io/bpmn-js-data-simulation/)
runs Zeebe and Camunda 7 examples. Details: [usage](https://github.com/emaarco/bpmn-js-data-simulation/blob/main/docs/usage.md).

## What it covers

| Step                         | What happens                                                                           |
| ---------------------------- | -------------------------------------------------------------------------------------- |
| Start                        | ▶ opens a form with the variables the process reads; a scenario prefills it            |
| Tasks                        | Input and output mappings write process variables; task results come from the scenario |
| Gateways                     | Exclusive and inclusive gateways evaluate their conditions, including the default flow |
| No match or failed condition | The token waits at the gateway, marked red, until you fix the data                     |
| Unsupported condition        | The gateway keeps the token simulation's click                                         |
| Inspect                      | Gateway cards explain each decision; Process Data in the palette shows the variables   |

## Scenarios

Named sets of start variables and mocked task results, in a JSON file next to the diagram.

Details: [scenarios](https://github.com/emaarco/bpmn-js-data-simulation/blob/main/docs/scenarios.md).

## Zeebe and Camunda 7

`engine: 'zeebe'` reads `zeebe:ioMapping` and evaluates FEEL; `engine: 'camunda7'` reads
`camunda:inputOutput` and evaluates a subset of JUEL (also for Operaton and CIB seven).

Details: [engines](https://github.com/emaarco/bpmn-js-data-simulation/blob/main/docs/engines.md).

## Documentation

- [Usage](https://github.com/emaarco/bpmn-js-data-simulation/blob/main/docs/usage.md): setup, start dialog, decision cards, Process Data and API
- [Scenarios](https://github.com/emaarco/bpmn-js-data-simulation/blob/main/docs/scenarios.md): the scenario file and task results
- [Engines](https://github.com/emaarco/bpmn-js-data-simulation/blob/main/docs/engines.md): Zeebe and Camunda 7 semantics, gateways, the JUEL subset
- [How it works](https://github.com/emaarco/bpmn-js-data-simulation/blob/main/docs/how-it-works.md): how it plugs into the token simulation, decisions and limits

## Contributing

See [CONTRIBUTING.md](https://github.com/emaarco/bpmn-js-data-simulation/blob/main/CONTRIBUTING.md).

## License

[MIT](https://github.com/emaarco/bpmn-js-data-simulation/blob/main/LICENSE) © Marco Schäck
