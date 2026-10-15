import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const lib = (path: string) => fileURLToPath(new URL(`../bpmn-js-data-simulation/${path}`, import.meta.url))

export default defineConfig(({ command }) => ({
  base: './',
  server: { port: 5179, strictPort: true },
  preview: { port: 5179, strictPort: true },
  resolve: {
    alias:
      command === 'serve'
        ? [
            {
              find: '@emaarco/bpmn-js-data-simulation/assets/bpmn-js-data-simulation.css',
              replacement: lib('src/styles/bpmn-js-data-simulation.css'),
            },
            { find: '@emaarco/bpmn-js-data-simulation', replacement: lib('src/index.ts') },
          ]
        : [],
  },
}))
