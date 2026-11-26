import 'bpmn-js/dist/assets/diagram-js.css'
import 'bpmn-js/dist/assets/bpmn-js.css'
import '@emaarco/bpmn-js-data-simulation/assets/bpmn-js-data-simulation.css'
import '@fontsource-variable/geist'
import './path-simulation.css'

import { type PathSimulation, PathSimulationModule } from '@emaarco/bpmn-js-data-simulation'
import NavigatedViewer from 'bpmn-js/lib/NavigatedViewer'
import zeebeModdle from 'zeebe-bpmn-moddle/resources/zeebe.json'

const BIKE_ORDER = `${import.meta.env.BASE_URL}examples/bike-order.zeebe.bpmn`
const FIXED_VARIABLES = { creditworthy: true, approved: true, insurance: false, accessories: [] }

class PathSimulationViewer {
  private readonly viewer: NavigatedViewer
  private readonly pathSimulation: PathSimulation

  constructor(
    container: HTMLElement,
    private readonly orderTotal: HTMLInputElement,
    private readonly orderTotalValue: HTMLOutputElement,
  ) {
    this.viewer = new NavigatedViewer({
      container,
      additionalModules: [PathSimulationModule],
      moddleExtensions: { zeebe: zeebeModdle },
      dataSimulation: { engine: 'zeebe' },
    })
    this.pathSimulation = this.viewer.get<PathSimulation>('pathSimulation')
  }

  async start(): Promise<void> {
    await this.viewer.importXML(await (await fetch(BIKE_ORDER)).text())
    this.viewer.get<{ zoom(level: string): void }>('canvas').zoom('fit-viewport')
    this.orderTotal.addEventListener('input', () => this.simulate())
    this.simulate()
  }

  private simulate(): void {
    this.orderTotalValue.value = this.orderTotal.value
    this.pathSimulation.simulate({ ...FIXED_VARIABLES, orderTotal: this.orderTotal.valueAsNumber })
  }
}

void new PathSimulationViewer(
  document.querySelector<HTMLElement>('#canvas')!,
  document.querySelector<HTMLInputElement>('#order-total')!,
  document.querySelector<HTMLOutputElement>('#order-total-value')!,
).start()
