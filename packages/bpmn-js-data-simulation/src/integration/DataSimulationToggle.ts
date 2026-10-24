import { h } from '../utils/dom.js'
import type { DataSimulation } from './DataSimulation.js'
import { type Canvas, DATA_TOGGLE_EVENT, type EventBus, TOGGLE_MODE_EVENT } from './tokenSimulation.js'

const LABEL = 'Data Simulation'
const GAP = 8
const TOGGLE_ON =
  '<svg viewBox="0 0 26 14" aria-hidden="true"><rect x="1" y="1" width="24" height="12" rx="6" /><circle cx="18" cy="7" r="3.5" /></svg>'
const TOGGLE_OFF =
  '<svg viewBox="0 0 26 14" aria-hidden="true"><rect x="1" y="1" width="24" height="12" rx="6" /><circle cx="8" cy="7" r="3.5" /></svg>'

interface ToggleMode {
  toggleMode(active: boolean): void
}

export class DataSimulationToggle {
  static $inject = ['eventBus', 'canvas', 'toggleMode', 'dataSimulation']

  private readonly button = h('button', { className: 'bds-data-toggle', type: 'button' })
  private simulating = false
  private tokenToggleObserver?: ResizeObserver

  constructor(
    eventBus: EventBus,
    private readonly canvas: Canvas,
    toggleMode: ToggleMode,
    private readonly dataSimulation: DataSimulation,
  ) {
    this.render()
    canvas.getContainer().append(this.button)
    this.button.addEventListener('click', () => dataSimulation.setEnabled(!dataSimulation.isEnabled()))

    eventBus.on(TOGGLE_MODE_EVENT, ({ active }: { active: boolean }) => {
      this.simulating = active
      if (active) this.placeNextToTokenSimulationToggle()
    })
    eventBus.on(DATA_TOGGLE_EVENT, () => {
      this.render()
      if (!this.simulating) return
      toggleMode.toggleMode(false)
      toggleMode.toggleMode(true)
    })
    eventBus.on('diagram.destroy', () => {
      this.tokenToggleObserver?.disconnect()
      this.button.remove()
    })
  }

  private render(): void {
    const enabled = this.dataSimulation.isEnabled()
    this.button.innerHTML = `${LABEL} <span class="bds-data-toggle-icon">${enabled ? TOGGLE_ON : TOGGLE_OFF}</span>`
    this.button.classList.toggle('active', enabled)
    this.button.setAttribute('aria-pressed', String(enabled))
  }

  private placeNextToTokenSimulationToggle(): void {
    const container = this.canvas.getContainer()
    const tokenToggle = container.querySelector<HTMLElement>('.bts-toggle-mode')
    if (!tokenToggle) return
    const containerBox = container.getBoundingClientRect()
    const toggleBox = tokenToggle.getBoundingClientRect()
    const scale = containerBox.width / container.offsetWidth || 1
    this.button.style.fontSize = getComputedStyle(tokenToggle).fontSize
    this.button.style.left = `${(toggleBox.right - containerBox.left) / scale + GAP}px`
    this.button.style.top = `${(toggleBox.top + toggleBox.height / 2 - containerBox.top) / scale - this.button.offsetHeight / 2}px`
    this.observeTokenToggle(tokenToggle)
  }

  private observeTokenToggle(tokenToggle: HTMLElement): void {
    if (this.tokenToggleObserver || typeof ResizeObserver !== 'function') return
    this.tokenToggleObserver = new ResizeObserver(() => this.placeNextToTokenSimulationToggle())
    this.tokenToggleObserver.observe(tokenToggle)
  }
}
