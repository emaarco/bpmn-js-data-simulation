import type { FlowOutcome } from '../domain/model.js'
import type { ConditionInput, DecisionLogEntry } from '../simulation/DataSimulationStore.js'
import { formatValue, h } from './dom.js'

const OUTCOME_LABELS: Record<FlowOutcome, { symbol: string; title: string }> = {
  taken: { symbol: '✓', title: 'Taken' },
  'not-taken': { symbol: '✗', title: 'Condition is false' },
  error: { symbol: '!', title: 'Condition could not be evaluated' },
  skipped: { symbol: '–', title: 'Not evaluated' },
}

const DEFAULT_FLOW_TITLES: Partial<Record<FlowOutcome, string>> = {
  taken: 'Default flow taken, no condition is true',
  'not-taken': 'Default flow not needed',
}

export function createOutcomeBadge(outcome: FlowOutcome, detail?: string, isDefault = false): HTMLElement {
  const { symbol } = OUTCOME_LABELS[outcome]
  const title = (isDefault && DEFAULT_FLOW_TITLES[outcome]) || OUTCOME_LABELS[outcome].title
  const badge = document.createElement('span')
  badge.className = `bds-outcome bds-outcome--${outcome}`
  badge.textContent = symbol
  badge.title = detail ? `${title}: ${detail}` : title
  return badge
}

export function createDecisionCard(
  { elementName, gatewayKind, chosenBy, decision, inputs }: DecisionLogEntry,
  onClose?: () => void,
): HTMLElement {
  const closeButton = onClose
    ? h('button', { className: 'bds-icon-button bds-decision-close', type: 'button', 'aria-label': 'Close' }, '×')
    : null
  closeButton?.addEventListener('click', onClose!)
  return h(
    'div',
    { className: `bds-decision${decision.stuckReason ? ' bds-decision--stuck' : ''}`, role: 'note' },
    h(
      'div',
      { className: 'bds-decision-title' },
      h('span', {}, elementName),
      h('span', { className: 'bds-tag' }, chosenBy === 'click' ? `${gatewayKind} · by click` : gatewayKind),
      closeButton,
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
          createOutcomeBadge(outcome, reason, flow.isDefault),
          h('span', { className: 'bds-flow-name' }, flow.name ?? flow.id),
          flow.isDefault
            ? h('span', { className: 'bds-tag' }, 'default')
            : flow.expression && h('code', {}, flow.expression),
        ),
      ),
    ),
    inputs.length ? createInputList(inputs) : null,
  )
}

function createInputList(inputs: ConditionInput[]): HTMLElement {
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
