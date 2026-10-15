# Contributing

Thanks for your interest in `@emaarco/bpmn-js-data-simulation`! Contributions of all
kinds are welcome — bug reports, feature ideas, docs, and code.

## Getting started

```bash
git clone https://github.com/emaarco/bpmn-js-data-simulation.git
cd bpmn-js-data-simulation
npm install
npm test
```

The repository is an npm-workspaces monorepo:

- `packages/bpmn-js-data-simulation` — the published library
- `packages/example` — an example bpmn-js modeler with the token simulation

## Scripts

```bash
npm test              # unit + integration tests (Vitest)
npm run typecheck     # tsc --noEmit
npm run lint          # oxlint
npm run lint:deps     # dependency-cruiser architecture check
npm run knip          # unused files, exports and dependencies
npm run format        # prettier
npm run build         # build the library (Rollup → ESM + CJS + d.ts + CSS)
npm run dev           # run the example modeler (Vite, http://localhost:5179)
npm run test:e2e      # Playwright E2E against the example app
npm run test:consumer -w @emaarco/bpmn-js-data-simulation  # packed build in a fresh project (Node + Vitest)
```

## Ground rules

- **Conventional Commits.** Commit messages and PR titles follow
  [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`,
  `docs:`, `refactor:`, `test:`, `chore:`). Releases and the changelog are
  generated from them via release-please.
- **Keep the layering intact.** The library is split into `domain/` (pure,
  engine-neutral routing, scenarios and variables), `engines/` (one adapter per
  engine), `simulation/` (the observable store), `ui/` (plain-DOM panel) and
  `integration/` (the bpmn-js / token-simulation modules). Imports only ever
  point "down", and token-simulation internals stay in `integration/`;
  `npm run lint:deps` (dependency-cruiser) enforces this in CI.
- **Add tests.** Routing, engines and the store are covered by unit tests, and
  `test/integration` runs the real token-simulation simulator against the
  module. Please extend them for any behavior change.
- **Adding an engine** = one adapter under `src/engines/<engine>/` implementing
  `EngineAdapter`, registered in `src/engines/index.ts`, with tests against a
  fixture in `test/fixtures/`.

## Betas

To try a change in a real project before it is released, publish a beta: run the
**Release** workflow manually on the branch and give a `beta_version` such as
`0.2.0-beta.0` (the version the change will be released as, plus `-beta.N`). It
lands on npm under the `beta` dist-tag with provenance. Nothing is committed,
tagged or released, and `latest` stays where it is. A published version can never
be overwritten or reused, so the next one is `-beta.1`. Tick `dry_run` as well to
rehearse the publish. Install it with
`npm i @emaarco/bpmn-js-data-simulation@0.2.0-beta.0`.

## Before opening a PR

```bash
npm run typecheck
npm run lint
npm run lint:deps
npm run knip
npm test
npm run build
```

All of these run in CI on Node 22 and 24 (Node 22 also runs the Playwright E2E suite).

## Reporting bugs / requesting features

Use the GitHub issue templates. For simulation bugs, attaching the `.bpmn` file,
the scenario JSON and the engine you selected is the fastest path to a fix.
