import type { EngineId } from '@emaarco/bpmn-js-data-simulation'
import { BLANK_BPMN, Editor, type Model } from './Editor'
import { HashAutosave } from './HashAutosave'
import { ShareLink } from './ShareLink'
import { detectEngine } from './utils/detectEngine'

const EXAMPLE_HASH_PREFIX = '#example='
const TOAST_DURATION = 2200

type Status = 'loading' | 'ready' | 'error'

export class ExampleApp {
  private readonly status = this.find<HTMLElement>('#status')
  private readonly picker = this.find<HTMLSelectElement>('#file-picker')
  private readonly stage = this.find<HTMLElement>('#stage')
  private readonly btnMenu = this.find<HTMLButtonElement>('#btn-menu')
  private readonly menu = this.find<HTMLElement>('#menu-dropdown')
  private readonly btnNew = this.find<HTMLButtonElement>('#btn-new')
  private readonly btnOpen = this.find<HTMLButtonElement>('#btn-open')
  private readonly btnShare = this.find<HTMLButtonElement>('#btn-share')
  private readonly btnReset = this.find<HTMLButtonElement>('#btn-reset')
  private readonly fileInput = this.find<HTMLInputElement>('#file-input')
  private readonly toast = this.find<HTMLElement>('#toast')
  private readonly editor = new Editor(this.find<HTMLElement>('#canvas'), this.find<HTMLElement>('#properties'))
  private readonly shareLink = new ShareLink()
  private readonly autosave = new HashAutosave(this.editor, this.shareLink)
  private toastTimer?: number

  constructor() {
    this.editor.onToggleSimulation(active => {
      document.body.classList.toggle('is-simulating', active)
      this.editor.fit()
    })
    Object.assign(window as object, { __editor: this.editor })
    this.listenToMenu()
    this.listenToFileDrops()
  }

  async start(): Promise<void> {
    const sharedModel = await this.shareLink.read()
    if (sharedModel) {
      this.picker.selectedIndex = -1
      await this.applyModel(sharedModel)
      return
    }
    const example = this.exampleFromHash()
    if (example) example.selected = true
    await this.loadExample(this.picker.selectedOptions[0])
  }

  private find<T extends Element>(selector: string): T {
    return document.querySelector<T>(selector)!
  }

  private listenToMenu(): void {
    this.btnMenu.addEventListener('click', () =>
      this.setMenuOpen(this.btnMenu.getAttribute('aria-expanded') !== 'true'),
    )
    document.addEventListener('click', event => {
      const target = event.target as Node
      if (!this.menu.hidden && !this.menu.contains(target) && !this.btnMenu.contains(target)) this.setMenuOpen(false)
    })
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') this.setMenuOpen(false)
    })
    this.picker.addEventListener('change', () => {
      this.setMenuOpen(false)
      void this.loadExample(this.picker.selectedOptions[0])
    })
    this.btnReset.addEventListener('click', () => {
      this.picker.selectedIndex = 0
      this.setMenuOpen(false)
      void this.loadExample(this.picker.selectedOptions[0])
    })
    this.btnNew.addEventListener('click', () => {
      this.setMenuOpen(false)
      this.picker.selectedIndex = -1
      void this.applyModel({ xml: BLANK_BPMN, engine: 'zeebe' })
    })
    this.btnOpen.addEventListener('click', () => this.fileInput.click())
    this.btnShare.addEventListener('click', () => void this.share())
  }

  private listenToFileDrops(): void {
    this.fileInput.addEventListener('change', () => {
      const file = this.fileInput.files?.[0]
      this.setMenuOpen(false)
      if (file) void this.importFile(file)
      this.fileInput.value = ''
    })
    this.stage.addEventListener('dragover', event => {
      event.preventDefault()
      this.stage.classList.add('is-dragover')
    })
    this.stage.addEventListener('dragleave', () => this.stage.classList.remove('is-dragover'))
    this.stage.addEventListener('drop', event => {
      event.preventDefault()
      this.stage.classList.remove('is-dragover')
      const file = event.dataTransfer?.files?.[0]
      if (file) void this.importFile(file)
    })
  }

  private showToast(message: string): void {
    this.toast.textContent = message
    this.toast.hidden = false
    window.clearTimeout(this.toastTimer)
    this.toastTimer = window.setTimeout(() => (this.toast.hidden = true), TOAST_DURATION)
  }

  private setStatus(state: Status, text: string = state): void {
    this.status.textContent = state === 'loading' ? 'loading…' : text
    this.status.dataset.state = state
  }

  private describeError(error: unknown): string {
    return `error: ${error instanceof Error ? error.message : String(error)}`
  }

  private setMenuOpen(open: boolean): void {
    this.menu.hidden = !open
    this.btnMenu.setAttribute('aria-expanded', String(open))
  }

  private async applyModel(model: Model, { simulate = false, persist = true } = {}): Promise<void> {
    this.setStatus('loading')
    try {
      await this.editor.open(model, { simulate })
      this.setStatus('ready')
      if (persist) void this.shareLink.syncHash(model)
    } catch (error) {
      this.setStatus('error', this.describeError(error))
      console.error(error)
    }
  }

  private async fetchText(path: string): Promise<string> {
    const url = new URL(path.replace(/^\//, ''), new URL(import.meta.env.BASE_URL, location.href)).href
    const response = await fetch(url)
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
    return response.text()
  }

  private async loadExample(option: HTMLOptionElement): Promise<void> {
    this.autosave.cancel()
    this.setStatus('loading')
    try {
      const [xml, scenarios] = await Promise.all([
        this.fetchText(option.value),
        this.fetchText(option.dataset.scenarios!).then(text => JSON.parse(text) as unknown),
      ])
      await this.applyModel(
        { xml, engine: option.dataset.engine as EngineId, scenarios },
        { simulate: true, persist: false },
      )
      history.replaceState(null, '', `${EXAMPLE_HASH_PREFIX}${encodeURIComponent(option.value)}`)
    } catch (error) {
      this.setStatus('error', this.describeError(error))
      console.error(error)
    }
  }

  private async importFile(file: File): Promise<void> {
    const text = await file.text()
    if (file.name.endsWith('.json')) {
      try {
        this.editor.setScenarios(JSON.parse(text))
        void this.shareLink.syncHash(await this.editor.save())
        this.showToast('Szenarien geladen')
      } catch (error) {
        this.showToast(this.describeError(error))
      }
      return
    }
    this.picker.selectedIndex = -1
    await this.applyModel({ xml: text, engine: detectEngine(text) })
  }

  private async share(): Promise<void> {
    this.setMenuOpen(false)
    try {
      const model = await this.editor.save()
      await this.shareLink.syncHash(model)
      await navigator.clipboard.writeText(location.href)
      this.showToast('Link in die Zwischenablage kopiert')
    } catch (error) {
      console.error(error)
      this.showToast('Teilen fehlgeschlagen')
    }
  }

  private exampleFromHash(): HTMLOptionElement | undefined {
    if (!location.hash.startsWith(EXAMPLE_HASH_PREFIX)) return undefined
    const path = decodeURIComponent(location.hash.slice(EXAMPLE_HASH_PREFIX.length))
    return [...this.picker.options].find(option => option.value === path)
  }
}
