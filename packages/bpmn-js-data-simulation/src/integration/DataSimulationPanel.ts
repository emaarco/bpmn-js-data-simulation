import { VariablesPanel } from '../ui/VariablesPanel.js'
import { inShadow } from '../utils/shadow.js'
import type { DataSimulation } from './DataSimulation.js'
import { type Canvas, DATA_TOGGLE_EVENT, type EventBus, TOGGLE_MODE_EVENT } from './tokenSimulation.js'

const PALETTE_INDEX = 4

interface TokenSimulationPalette {
  addEntry(entry: HTMLElement, index: number): void
}

export class DataSimulationPanel {
  static $inject = ['eventBus', 'canvas', 'tokenSimulationPalette', 'dataSimulation']

  private readonly panel: VariablesPanel

  constructor(
    eventBus: EventBus,
    canvas: Canvas,
    palette: TokenSimulationPalette,
    private readonly dataSimulation: DataSimulation,
  ) {
    this.panel = new VariablesPanel({
      selectInstance: instanceId => dataSimulation.selectInstance(instanceId),
      setInstanceVariables: (instanceId, variables) => dataSimulation.setInstanceVariables(instanceId, variables),
    })
    this.panel.render(dataSimulation.getSnapshot())
    const host = inShadow(this.panel.element)
    canvas.getContainer().append(host)
    palette.addEntry(this.panel.paletteEntry, PALETTE_INDEX)
    this.showPaletteEntry()

    const unsubscribe = dataSimulation.subscribe(snapshot => this.panel.render(snapshot))
    eventBus.on(TOGGLE_MODE_EVENT, () => this.panel.toggle(false))
    eventBus.on(DATA_TOGGLE_EVENT, () => this.showPaletteEntry())
    eventBus.on('diagram.destroy', () => {
      unsubscribe()
      host.remove()
      this.panel.paletteEntry.remove()
    })
  }

  private showPaletteEntry(): void {
    this.panel.paletteEntry.hidden = !this.dataSimulation.isEnabled()
  }
}
