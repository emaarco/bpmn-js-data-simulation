# @emaarco/bpmn-js-data-simulation-example

A small [Vite](https://vitejs.dev/) app that embeds a [bpmn-js](https://github.com/bpmn-io/bpmn-js) modeler with the [token simulation](https://github.com/bpmn-io/bpmn-js-token-simulation) and [`@emaarco/bpmn-js-data-simulation`](../bpmn-js-data-simulation). It's both the **live demo** ([emaarco.github.io/bpmn-js-data-simulation](https://emaarco.github.io/bpmn-js-data-simulation/)) and the reference integration.

> This package is `private` — it is never published to npm. It exists to demo and E2E-test the library.

## Running it

From the **repository root**:

```bash
npm install
npm run dev      # starts the example on http://localhost:5179
```

During `dev`, Vite aliases `@emaarco/bpmn-js-data-simulation` straight to the sibling package's `src/` (see [`vite.config.ts`](./vite.config.ts)), so changes to the library are picked up without a rebuild.

## What it demonstrates

- Registering the module after the token simulation, with the moddle extension and properties panel of the selected engine. The properties panel is shown while modeling, the data panel while simulating.
- Examples under [`public/examples`](./public/examples), each with a `.scenarios.json` next to it:
  - **`bike-order.zeebe.bpmn`**: exclusive and inclusive gateways, FEEL conditions, output mappings, a default flow, and a scenario where a missing variable stops the token.
  - **`bike-service.zeebe.bpmn`**: an output mapping that calculates the invoice in FEEL.
  - **`bike-order.camunda7.bpmn`**: the same order process with `camunda:inputOutput` and JUEL.
  - **`return-handling.camunda7.bpmn`**: a gateway with JavaScript conditions that falls back to the click.
- Starting instances through the start dialog, prefilled from the scenarios.
- Opening or dropping your own `.bpmn` (engine detected from its namespace) or a scenario `.json`, and a share link that encodes model and scenarios in the URL.

## End-to-end tests

The [Playwright](https://playwright.dev/) suite in [`e2e/`](./e2e) drives this app in a real browser:

```bash
npm run test:e2e   # from the repo root
```

## Layout

```
example/
├─ index.html          # canvas, burger menu with the example picker, properties panel
├─ src/
│  ├─ main.ts          # menu, file import, share link, start-up
│  ├─ editor.ts        # creates the modeler per engine and loads models + scenarios
│  ├─ persistence.ts   # keeps the URL hash in sync with the model
│  ├─ share.ts         # encodes model + scenarios into the URL hash
│  └─ style.css        # demo-app chrome (not part of the library)
├─ public/examples/    # sample .bpmn models with their scenarios
└─ e2e/                # Playwright specs
```
