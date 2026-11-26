# Changelog

## [0.6.0](https://github.com/emaarco/bpmn-js-data-simulation/compare/v0.5.0...v0.6.0) (2026-11-26)


### Features

* keep slider ranges stable on re-derive and let hosts override them ([#40](https://github.com/emaarco/bpmn-js-data-simulation/issues/40)) ([b007866](https://github.com/emaarco/bpmn-js-data-simulation/commit/b0078663fd8bd4dadc8459cd99565115c142ee10))
* route conditional sequence flows that leave an activity ([#37](https://github.com/emaarco/bpmn-js-data-simulation/issues/37)) ([55eca32](https://github.com/emaarco/bpmn-js-data-simulation/commit/55eca32685ae8899b6cac43a186dd0c2a161f5e1))
* run multi-instance activities with the instance count from the scenario ([#38](https://github.com/emaarco/bpmn-js-data-simulation/issues/38)) ([41fbc51](https://github.com/emaarco/bpmn-js-data-simulation/commit/41fbc5133ddfc35d5d865bd036b58c5d99a4c8c9))


### Bug Fixes

* **deps:** bump the npm-minor-patch group with 11 updates ([#41](https://github.com/emaarco/bpmn-js-data-simulation/issues/41)) ([16f529c](https://github.com/emaarco/bpmn-js-data-simulation/commit/16f529caf4a1a2f30368026ffcf490dc808498fa))

## [0.5.0](https://github.com/emaarco/bpmn-js-data-simulation/compare/v0.4.0...v0.5.0) (2026-11-26)


### Features

* derive path variables and scenario values on the path simulation ([#35](https://github.com/emaarco/bpmn-js-data-simulation/issues/35)) ([79d895b](https://github.com/emaarco/bpmn-js-data-simulation/commit/79d895bb158893aa9d8c94cceb7a04b0955a36b5)), closes [#34](https://github.com/emaarco/bpmn-js-data-simulation/issues/34)

## [0.4.0](https://github.com/emaarco/bpmn-js-data-simulation/compare/v0.3.0...v0.4.0) (2026-11-26)


### Features

* simulate the path without the token simulation ([#30](https://github.com/emaarco/bpmn-js-data-simulation/issues/30)) ([a5a167b](https://github.com/emaarco/bpmn-js-data-simulation/commit/a5a167bd2288783f71f3d388f50851768f116f44))
* stateless what-if mode (variables → path) ([#27](https://github.com/emaarco/bpmn-js-data-simulation/issues/27)) ([08b1339](https://github.com/emaarco/bpmn-js-data-simulation/commit/08b1339234b4622430fe6daf59e834104fac6974))


### Bug Fixes

* **deps:** make bpmn-js-token-simulation an optional peer ([a5a167b](https://github.com/emaarco/bpmn-js-data-simulation/commit/a5a167bd2288783f71f3d388f50851768f116f44))

## [0.3.0](https://github.com/emaarco/bpmn-js-data-simulation/compare/v0.2.0...v0.3.0) (2026-11-04)


### ⚠ BREAKING CHANGES

* EngineAdapter.readInputMappings and readOutputMappings are replaced by readIoMappings(element), which returns { inputs, outputs }.

### Bug Fixes

* **deps:** accept bpmn-js-token-simulation ^1.0.0 as peer ([#16](https://github.com/emaarco/bpmn-js-data-simulation/issues/16)) ([ce86ed8](https://github.com/emaarco/bpmn-js-data-simulation/commit/ce86ed8a89e7f9f1d15c532094f4f4427a584799))


### Code Refactoring

* merge engine io-mapping readers into readIoMappings ([#12](https://github.com/emaarco/bpmn-js-data-simulation/issues/12)) ([d002df3](https://github.com/emaarco/bpmn-js-data-simulation/commit/d002df3b4f24ef518d2eeb59e84091dd177b95b5))

## [0.2.0](https://github.com/emaarco/bpmn-js-data-simulation/compare/v0.1.0...v0.2.0) (2026-10-24)


### ⚠ BREAKING CHANGES

* routeGateway, parseScenarios, resolveEngine, parseFieldValue, formatFieldValue and simpleStartFormRenderer are replaced by the classes GatewayRouter, ScenarioParser, EngineRegistry, StartFieldCodec and SimpleStartFormRenderer. ZeebeEngine and Camunda7Engine are exported as classes; zeebeEngine and camunda7Engine stay available as instances.

### Code Refactoring

* restructure the add-on around classes with pure helpers in utils ([#10](https://github.com/emaarco/bpmn-js-data-simulation/issues/10)) ([f6dcf37](https://github.com/emaarco/bpmn-js-data-simulation/commit/f6dcf3712aefb847963f0870d38923a0f5d9733c))

## 0.1.0 (2026-10-15)


### Features

* add bpmn-js-data-simulation, a data-driven add-on for the token simulation ([#1](https://github.com/emaarco/bpmn-js-data-simulation/issues/1)) ([ef928df](https://github.com/emaarco/bpmn-js-data-simulation/commit/ef928dfc2749f922edaef507f504596a6fd69da8))
