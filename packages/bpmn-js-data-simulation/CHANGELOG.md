# Changelog

## [0.2.0](https://github.com/emaarco/bpmn-js-data-simulation/compare/v0.1.0...v0.2.0) (2026-10-24)


### ⚠ BREAKING CHANGES

* routeGateway, parseScenarios, resolveEngine, parseFieldValue, formatFieldValue and simpleStartFormRenderer are replaced by the classes GatewayRouter, ScenarioParser, EngineRegistry, StartFieldCodec and SimpleStartFormRenderer. ZeebeEngine and Camunda7Engine are exported as classes; zeebeEngine and camunda7Engine stay available as instances.

### Code Refactoring

* restructure the add-on around classes with pure helpers in utils ([#10](https://github.com/emaarco/bpmn-js-data-simulation/issues/10)) ([f6dcf37](https://github.com/emaarco/bpmn-js-data-simulation/commit/f6dcf3712aefb847963f0870d38923a0f5d9733c))

## 0.1.0 (2026-10-15)


### Features

* add bpmn-js-data-simulation, a data-driven add-on for the token simulation ([#1](https://github.com/emaarco/bpmn-js-data-simulation/issues/1)) ([ef928df](https://github.com/emaarco/bpmn-js-data-simulation/commit/ef928dfc2749f922edaef507f504596a6fd69da8))
