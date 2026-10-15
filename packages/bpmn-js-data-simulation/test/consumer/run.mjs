import { execFileSync } from 'node:child_process'
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageDir = fileURLToPath(new URL('../..', import.meta.url))
const require = createRequire(join(packageDir, 'package.json'))
const consumerDir = mkdtempSync(join(tmpdir(), 'bds-consumer-'))
const pinned = name => `${name}@${require(`${name}/package.json`).version}`
const run = (command, args) => execFileSync(command, args, { cwd: consumerDir, stdio: 'inherit' })

try {
  const [{ filename }] = Object.values(
    JSON.parse(
      execFileSync('npm', ['pack', '--json', '--pack-destination', consumerDir], { cwd: packageDir, encoding: 'utf8' }),
    ),
  )
  cpSync(fileURLToPath(new URL('./fixture', import.meta.url)), consumerDir, { recursive: true })
  writeFileSync(join(consumerDir, 'package.json'), JSON.stringify({ name: 'consumer', private: true, type: 'module' }))
  run('npm', [
    'install',
    '--no-audit',
    '--no-fund',
    '--legacy-peer-deps',
    `./${filename}`,
    pinned('bpmn-js'),
    pinned('bpmn-js-token-simulation'),
    pinned('vitest'),
    pinned('vite'),
  ])
  run('node', ['load.mjs'])
  run('node', ['load.cjs'])
  run('npx', ['vitest', 'run'])
} finally {
  rmSync(consumerDir, { recursive: true, force: true })
}
