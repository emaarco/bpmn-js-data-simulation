import { h } from '../ui/dom.js'
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

  constructor(eventBus: EventBus, canvas: Canvas, toggleMode: ToggleMode, dataSimulation: DataSimulation) {
    let simulating = false
    const button = h('button', { className: 'bds-data-toggle', type: 'button' })
    const render = (): void => {
      const enabled = dataSimulation.isEnabled()
      button.innerHTML = `${LABEL} <span class="bds-data-toggle-icon">${enabled ? TOGGLE_ON : TOGGLE_OFF}</span>`
      button.classList.toggle('active', enabled)
      button.setAttribute('aria-pressed', String(enabled))
    }
    let tokenToggleObserver: ResizeObserver | undefined
    const placeNextToTokenSimulationToggle = (): void => {
      const container = canvas.getContainer()
      const tokenToggle = container.querySelector<HTMLElement>('.bts-toggle-mode')
      if (!tokenToggle) return
      const containerBox = container.getBoundingClientRect()
      const toggleBox = tokenToggle.getBoundingClientRect()
      const scale = containerBox.width / container.offsetWidth || 1
      button.style.fontSize = getComputedStyle(tokenToggle).fontSize
      button.style.left = `${(toggleBox.right - containerBox.left) / scale + GAP}px`
      button.style.top = `${(toggleBox.top + toggleBox.height / 2 - containerBox.top) / scale - button.offsetHeight / 2}px`
      if (!tokenToggleObserver && typeof ResizeObserver === 'function') {
        tokenToggleObserver = new ResizeObserver(placeNextToTokenSimulationToggle)
        tokenToggleObserver.observe(tokenToggle)
      }
    }

    render()
    canvas.getContainer().append(button)
    button.addEventListener('click', () => dataSimulation.setEnabled(!dataSimulation.isEnabled()))

    eventBus.on(TOGGLE_MODE_EVENT, ({ active }: { active: boolean }) => {
      simulating = active
      if (active) placeNextToTokenSimulationToggle()
    })
    eventBus.on(DATA_TOGGLE_EVENT, () => {
      render()
      if (!simulating) return
      toggleMode.toggleMode(false)
      toggleMode.toggleMode(true)
    })
    eventBus.on('diagram.destroy', () => {
      tokenToggleObserver?.disconnect()
      button.remove()
    })
  }
}
