# How it works, decisions and limits

## How it plugs into the token simulation

- It hooks into the token simulation's exclusive and inclusive gateway behaviors and settings, which it gets from the injector. A gateway whose conditions the adapter can evaluate routes by data; any other gateway keeps the original behavior.
- It also wraps the activity behavior's `exit`, which events, gateways and sub-processes share. Only an activity that completes normally and has conditional or default outgoing flows routes by data; it then leaves through the original `exit`, limited to the flows it takes, so compensation and the end of the scope stay with the token simulation.
- It listens to the simulator's `trace` event (`exit`) to apply io mappings before the token moves on, and to `createScope` to seed every process instance with its start variables.
- It wraps the `enter` and `exit` of the activity and sub-process behaviors for multi-instance activities: the activity's own scope holds one child scope per instance and exits after the last one. A task instance works for the length of a short token animation inside the shape, so pause, speed and reset of the token simulation apply to it.
- It wraps the context pads: ▶ on a process start event opens the start dialog, and gateways that route by data lose their click-to-choose pad.
- Its flow badges (overlay type `bds-flow-outcome`) and the instance dots of multi-instance activities (`bds-loop-progress`) stay visible in simulation mode, where the token simulation hides foreign overlays, and keep a minimum size when zoomed out. Decision cards are not overlays but a layer on top of the canvas, placed next to the gateway on screen. Gateways and activities that route by their flows get the canvas markers `bds-gateway--decided` and `bds-gateway--stuck`, which color the shape itself, so they never cover other elements.

These are internal APIs without a stability guarantee. So the add-on accepts any token simulation `1.x` as peer but develops and tests against one exact version. Dependabot proposes every new release, an integration test runs the real simulator against the add-on, and a test checks that the internals it builds on still exist.

The add-on imports nothing from bpmn-js or the token simulation; it reaches them only through the injector. Its build therefore loads in plain Node (ESM and CommonJS) and in Vitest without extra config, e.g. in the unit tests of an app that uses it. A consumer test installs the packed build into a fresh project to keep it that way. Register it next to the token simulation module; the order does not matter.

The package ships two modules. `DataSimulationModule` is the full data simulation and needs `bpmn-js-token-simulation` next to it; without it, it throws a readable error. `PathSimulationModule` holds only the path simulation (`pathSimulation`) and needs nothing but `elementRegistry` and `canvas`, so a plain viewer can load it; `DataSimulationModule` includes it.

## Decisions

The answers this version gives to the open questions of [slidev-addon-diagram-js#135](https://github.com/emaarco/slidev-addon-diagram-js/issues/135):

- **Standalone package:** a bpmn-js add-on of its own, so any bpmn-js app can use it; the Slidev addon is its first consumer.
- **Engines first:** Zeebe (FEEL) and Camunda 7 (JUEL, also Operaton and CIB seven). Flowable could follow as another adapter.
- **JUEL and scripts:** a subset of JUEL is evaluated; method calls and script conditions fall back to the click.
- **Scenarios:** in a JSON file next to the diagram, not inside the BPMN.
- **Variable scope:** one set of variables per process instance; sub-processes share it.
- **FEEL:** evaluated with feelin directly rather than through `@emaarco/dmn-js-simulation`, whose `evaluateExpression` returns `null` on errors and could not tell a failed condition from a `null` result.

## Limits

- Input mappings are evaluated when the element completes, and their local variables are not visible to the elements inside a sub-process.
- Multi-instance activities do not set the input element and collect no output collection; a completion condition is ignored. The token count of the token simulation shows two badges on such an activity: one for the activity, one for its running instances.
- `camunda:list`, `camunda:map` and script parameters are skipped.
- The token simulation 1.0.0 keeps its context pads cached by element id. If you import a second diagram into the same modeler and it reuses element ids (e.g. `StartEvent_1`), toggle the simulation off and on once, or create a new modeler per diagram as the example does.
