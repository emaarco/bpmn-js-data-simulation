import type { FlowOutcome } from '../domain/model.js'

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

export class OutcomeBadge {
  readonly element = document.createElement('span')

  constructor(outcome: FlowOutcome, detail?: string, isDefault = false) {
    const title = (isDefault && DEFAULT_FLOW_TITLES[outcome]) || OUTCOME_LABELS[outcome].title
    this.element.className = `bds-outcome bds-outcome--${outcome}`
    this.element.textContent = OUTCOME_LABELS[outcome].symbol
    this.element.title = detail ? `${title}: ${detail}` : title
  }
}
