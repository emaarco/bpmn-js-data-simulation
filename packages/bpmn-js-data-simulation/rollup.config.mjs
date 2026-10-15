import { cpSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, resolve as resolvePath } from 'node:path'
import commonjs from '@rollup/plugin-commonjs'
import resolve from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'

function isExternal(id) {
  return /^(bpmn-js|bpmn-js-token-simulation|diagram-js|feelin)(\/|$)/.test(id)
}

const INLINE_QUERY = '?inline'

const inlineCss = {
  name: 'inline-css',
  resolveId(source, importer) {
    if (!source.endsWith(`.css${INLINE_QUERY}`) || !importer) return null
    return resolvePath(dirname(importer), source)
  },
  load(id) {
    if (!id.endsWith(`.css${INLINE_QUERY}`)) return null
    const file = id.slice(0, -INLINE_QUERY.length)
    this.addWatchFile(file)
    return `export default ${JSON.stringify(readFileSync(file, 'utf8'))}`
  },
}

const copyStyles = {
  name: 'copy-styles',
  writeBundle() {
    mkdirSync('dist/assets', { recursive: true })
    cpSync('src/styles/bpmn-js-data-simulation.css', 'dist/assets/bpmn-js-data-simulation.css')
  },
}

/** @type {import('rollup').RollupOptions} */
export default {
  input: 'src/index.ts',
  external: isExternal,
  output: [
    {
      file: 'dist/index.js',
      format: 'es',
      sourcemap: true,
    },
    {
      file: 'dist/index.cjs',
      format: 'cjs',
      sourcemap: true,
      exports: 'named',
      interop: 'auto',
    },
  ],
  plugins: [
    inlineCss,
    resolve({ browser: true, extensions: ['.ts', '.js', '.mjs'] }),
    commonjs(),
    typescript({ tsconfig: './tsconfig.build.json', outDir: 'dist', declaration: true, declarationDir: 'dist' }),
    copyStyles,
  ],
}
