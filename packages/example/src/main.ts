import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'

import type { EngineId } from '@emaarco/bpmn-js-data-simulation'
import { BLANK_BPMN, detectEngine, Editor, type Model } from './editor'
import { initHashAutosave, syncHash } from './persistence'
import { readHashModel } from './share'
import './style.css'

const status = document.querySelector<HTMLElement>('#status')!
const picker = document.querySelector<HTMLSelectElement>('#file-picker')!
const canvas = document.querySelector<HTMLElement>('#canvas')!
const stage = document.querySelector<HTMLElement>('#stage')!
const properties = document.querySelector<HTMLElement>('#properties')!
const btnMenu = document.querySelector<HTMLButtonElement>('#btn-menu')!
const menu = document.querySelector<HTMLElement>('#menu-dropdown')!
const btnNew = document.querySelector<HTMLButtonElement>('#btn-new')!
const btnOpen = document.querySelector<HTMLButtonElement>('#btn-open')!
const btnShare = document.querySelector<HTMLButtonElement>('#btn-share')!
const btnReset = document.querySelector<HTMLButtonElement>('#btn-reset')!
const fileInput = document.querySelector<HTMLInputElement>('#file-input')!
const toast = document.querySelector<HTMLElement>('#toast')!

const EXAMPLE_HASH_PREFIX = '#example='

const editor = new Editor(canvas, properties)
const cancelPendingAutosave = initHashAutosave(editor)

editor.onToggleSimulation(active => {
  document.body.classList.toggle('is-simulating', active)
  editor.fit()
})

Object.assign(window as object, { __editor: editor })

let toastTimer: number | undefined
function showToast(message: string): void {
  toast.textContent = message
  toast.hidden = false
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => (toast.hidden = true), 2200)
}

function setStatus(state: 'loading' | 'ready' | 'error', text: string = state): void {
  status.textContent = state === 'loading' ? 'loading…' : text
  status.dataset.state = state
}

function describeError(error: unknown): string {
  return `error: ${error instanceof Error ? error.message : String(error)}`
}

async function applyModel(model: Model, { simulate = false, persist = true } = {}): Promise<void> {
  setStatus('loading')
  try {
    await editor.open(model, { simulate })
    setStatus('ready')
    if (persist) void syncHash(model)
  } catch (error) {
    setStatus('error', describeError(error))
    console.error(error)
  }
}

async function fetchText(path: string): Promise<string> {
  const url = new URL(path.replace(/^\//, ''), new URL(import.meta.env.BASE_URL, location.href)).href
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
  return response.text()
}

async function loadExample(option: HTMLOptionElement): Promise<void> {
  cancelPendingAutosave()
  setStatus('loading')
  try {
    const [xml, scenarios] = await Promise.all([
      fetchText(option.value),
      fetchText(option.dataset.scenarios!).then(text => JSON.parse(text) as unknown),
    ])
    await applyModel({ xml, engine: option.dataset.engine as EngineId, scenarios }, { simulate: true, persist: false })
    history.replaceState(null, '', `${EXAMPLE_HASH_PREFIX}${encodeURIComponent(option.value)}`)
  } catch (error) {
    setStatus('error', describeError(error))
    console.error(error)
  }
}

async function importFile(file: File): Promise<void> {
  const text = await file.text()
  if (file.name.endsWith('.json')) {
    try {
      editor.setScenarios(JSON.parse(text))
      void syncHash(await editor.save())
      showToast('Szenarien geladen')
    } catch (error) {
      showToast(describeError(error))
    }
    return
  }
  picker.selectedIndex = -1
  await applyModel({ xml: text, engine: detectEngine(text) })
}

function setMenuOpen(open: boolean): void {
  menu.hidden = !open
  btnMenu.setAttribute('aria-expanded', String(open))
}

btnMenu.addEventListener('click', () => setMenuOpen(btnMenu.getAttribute('aria-expanded') !== 'true'))

document.addEventListener('click', event => {
  const target = event.target as Node
  if (!menu.hidden && !menu.contains(target) && !btnMenu.contains(target)) setMenuOpen(false)
})
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') setMenuOpen(false)
})

picker.addEventListener('change', () => {
  setMenuOpen(false)
  void loadExample(picker.selectedOptions[0])
})

btnReset.addEventListener('click', () => {
  picker.selectedIndex = 0
  setMenuOpen(false)
  void loadExample(picker.selectedOptions[0])
})

btnNew.addEventListener('click', () => {
  setMenuOpen(false)
  picker.selectedIndex = -1
  void applyModel({ xml: BLANK_BPMN, engine: 'zeebe' })
})

btnOpen.addEventListener('click', () => fileInput.click())

fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0]
  setMenuOpen(false)
  if (file) void importFile(file)
  fileInput.value = ''
})

stage.addEventListener('dragover', event => {
  event.preventDefault()
  stage.classList.add('is-dragover')
})
stage.addEventListener('dragleave', () => stage.classList.remove('is-dragover'))
stage.addEventListener('drop', event => {
  event.preventDefault()
  stage.classList.remove('is-dragover')
  const file = event.dataTransfer?.files?.[0]
  if (file) void importFile(file)
})

btnShare.addEventListener('click', async () => {
  setMenuOpen(false)
  try {
    const model = await editor.save()
    await syncHash(model)
    await navigator.clipboard.writeText(location.href)
    showToast('Link in die Zwischenablage kopiert')
  } catch (error) {
    console.error(error)
    showToast('Teilen fehlgeschlagen')
  }
})

function exampleFromHash(): HTMLOptionElement | undefined {
  if (!location.hash.startsWith(EXAMPLE_HASH_PREFIX)) return undefined
  const path = decodeURIComponent(location.hash.slice(EXAMPLE_HASH_PREFIX.length))
  return [...picker.options].find(option => option.value === path)
}

void (async () => {
  const sharedModel = await readHashModel()
  if (sharedModel) {
    picker.selectedIndex = -1
    await applyModel(sharedModel)
    return
  }
  const example = exampleFromHash()
  if (example) example.selected = true
  await loadExample(picker.selectedOptions[0])
})()
