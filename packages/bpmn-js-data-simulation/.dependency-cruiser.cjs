module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      comment: 'Circular dependencies make the module graph hard to reason about.',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'domain-is-a-leaf',
      comment: 'domain/ is the pure, engine-neutral core; it must not import from any upper layer.',
      severity: 'error',
      from: { path: '^src/domain/' },
      to: { path: '^src/(engines|simulation|ui|integration)/' },
    },
    {
      name: 'domain-is-framework-free',
      comment: 'domain/ must not depend on bpmn-js, the token simulation or an expression language.',
      severity: 'error',
      from: { path: '^src/domain/' },
      to: { dependencyTypes: ['npm', 'npm-peer', 'npm-dev', 'npm-optional', 'npm-no-pkg', 'npm-unknown'] },
    },
    {
      name: 'engines-only-to-domain',
      comment: 'An engine adapter maps moddle + expressions; it must not know about UI, store or integration.',
      severity: 'error',
      from: { path: '^src/engines/' },
      to: { path: '^src/(simulation|ui|integration)/' },
    },
    {
      name: 'simulation-only-to-domain',
      comment: 'The simulation store must not depend on engines, UI or the bpmn-js integration.',
      severity: 'error',
      from: { path: '^src/simulation/' },
      to: { path: '^src/(engines|ui|integration)/' },
    },
    {
      name: 'ui-not-to-integration-or-engines',
      comment: 'UI renders domain types + store snapshots; it must not import the modules or engine adapters.',
      severity: 'error',
      from: { path: '^src/ui/' },
      to: { path: '^src/(integration|engines)/' },
    },
    {
      name: 'utils-are-leaves',
      comment: 'utils/ holds pure helpers; they may read the types of other layers but never their behaviour.',
      severity: 'error',
      from: { path: '^src/utils/' },
      to: { path: '^src/', pathNot: '^src/(utils|styles)/', dependencyTypesNot: ['type-only'] },
    },
    {
      name: 'no-bpmn-io-imports',
      comment:
        'bpmn-js, diagram-js and the token simulation ship extensionless ESM that plain Node cannot load; the add-on gets their services through the injector instead.',
      severity: 'error',
      from: { path: '^src/' },
      to: { path: '(^|/)node_modules/(bpmn-js|bpmn-js-token-simulation|diagram-js)/' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      extensions: ['.ts', '.js'],
    },
  },
}
