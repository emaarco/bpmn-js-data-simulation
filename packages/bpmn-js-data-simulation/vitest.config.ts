import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['test/**/*.test.ts'],
    server: {
      deps: {
        inline: [/bpmn-js/, /diagram-js/],
      },
    },
  },
})
