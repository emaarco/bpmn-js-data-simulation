import { inShadow } from '../ui/shadow.js'
import { VariablesPanel } from '../ui/VariablesPanel.js'
import type { DataSimulation } from './DataSimulation.js'
import { type Canvas, DATA_TOGGLE_EVENT, type EventBus, TOGGLE_MODE_EVENT } from './tokenSimulation.js'

const PALETTE_INDEX = 4

interface TokenSimulationPalette {
  addEntry(entry: HTMLElement, index: number): void
}

export class DataSimulationPanel {
  static $inject = ['eventBus', 'canvas', 'tokenSimulationPalette', 'dataSimulation']

  constructor(eventBus: EventBus, canvas: Canvas, palette: TokenSimulationPalette, dataSimulation: DataSimulation) {
    const panel = new VariablesPanel({
      selectInstance: instanceId => dataSimulation.selectInstance(instanceId),
      setInstanceVariables: (instanceId, variables) => dataSimulation.setInstanceVariables(instanceId, variables),
    })
    panel.render(dataSimulation.getSnapshot())
    const host = inShadow(panel.element)
    canvas.getContainer().append(host)
    palette.addEntry(panel.paletteEntry, PALETTE_INDEX)
    const showPaletteEntry = (): void => {
      panel.paletteEntry.hidden = !dataSimulation.isEnabled()
    }
    showPaletteEntry()

    const unsubscribe = dataSimulation.subscribe(snapshot => panel.render(snapshot))
    eventBus.on(TOGGLE_MODE_EVENT, () => panel.toggle(false))
    eventBus.on(DATA_TOGGLE_EVENT, showPaletteEntry)
    eventBus.on('diagram.destroy', () => {
      unsubscribe()
      host.remove()
      panel.paletteEntry.remove()
    })
  }
}
