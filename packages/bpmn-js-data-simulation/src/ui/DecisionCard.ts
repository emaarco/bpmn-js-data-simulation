import type { ConditionInput, DecisionLogEntry } from '../simulation/DataSimulationStore.js'
import { formatValue, h } from '../utils/dom.js'
import { OutcomeBadge } from './OutcomeBadge.js'

export class DecisionCard {
  readonly element: HTMLElement

  constructor({ elementName, gatewayKind, chosenBy, decision, inputs }: DecisionLogEntry, onClose?: () => void) {
    this.element = h(
      'div',
      { className: `bds-decision${decision.stuckReason ? ' bds-decision--stuck' : ''}`, role: 'note' },
      h(
        'div',
        { className: 'bds-decision-title' },
        h('span', {}, elementName),
        h('span', { className: 'bds-tag' }, chosenBy === 'click' ? `${gatewayKind} · by click` : gatewayKind),
        onClose ? this.closeButton(onClose) : null,
      ),
      decision.stuckReason
        ? h(
            'p',
            { className: 'bds-error' },
            `${decision.stuckReason}. Change the variables in Process Data, then press ▶ on the gateway.`,
          )
        : null,
      h(
        'ul',
        { className: 'bds-flows' },
        ...decision.flows.map(({ flow, outcome, reason }) =>
          h(
            'li',
            { className: `bds-flow bds-flow--${outcome}` },
            new OutcomeBadge(outcome, reason, flow.isDefault).element,
            h('span', { className: 'bds-flow-name' }, flow.name ?? flow.id),
            flow.isDefault
              ? h('span', { className: 'bds-tag' }, 'default')
              : flow.expression && h('code', {}, flow.expression),
          ),
        ),
      ),
      inputs.length ? this.inputList(inputs) : null,
    )
  }

  private closeButton(onClose: () => void): HTMLElement {
    const button = h(
      'button',
      { className: 'bds-icon-button bds-decision-close', type: 'button', 'aria-label': 'Close' },
      '×',
    )
    button.addEventListener('click', onClose)
    return button
  }

  private inputList(inputs: ConditionInput[]): HTMLElement {
    return h(
      'dl',
      { className: 'bds-decision-inputs' },
      ...inputs.flatMap(({ name, value }) => [
        h('dt', {}, name),
        h(
          'dd',
          {},
          value === undefined ? h('span', { className: 'bds-hint' }, 'not set') : h('code', {}, formatValue(value)),
        ),
      ]),
    )
  }
}
