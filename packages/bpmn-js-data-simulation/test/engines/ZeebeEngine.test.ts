import { describe, expect, it } from 'vitest'
import { ZeebeEngine } from '../../src/engines/zeebe/ZeebeEngine'
import { loadFlowElements } from './moddle'

const zeebeEngine = new ZeebeEngine()

describe('ZeebeEngine', () => {
  it('reads zeebe:ioMapping inputs and outputs', async () => {
    const elements = await loadFlowElements('order-zeebe.bpmn', 'zeebe')
    const task = elements.get('Task_CheckCredit')!

    expect(zeebeEngine.readInputMappings(task)).toEqual([{ source: '=customer.id', target: 'customerId' }])
    expect(zeebeEngine.readOutputMappings(task)).toEqual([
      { source: '=score', target: 'creditScore' },
      { source: '=score >= 600', target: 'creditworthy' },
    ])
    expect(zeebeEngine.readOutputMappings(elements.get('Task_Ship')!)).toEqual([])
  })

  it('reads sequence flow conditions', async () => {
    const elements = await loadFlowElements('order-zeebe.bpmn', 'zeebe')

    expect(zeebeEngine.readCondition(elements.get('Flow_Approved')!)).toBe('=creditworthy and orderTotal <= 5000')
    expect(zeebeEngine.readCondition(elements.get('Flow_Rejected')!)).toBeUndefined()
  })

  it('evaluates FEEL expressions prefixed with "="', () => {
    expect(zeebeEngine.evaluate('=total > 100', { total: 150 })).toEqual({ ok: true, value: true })
    expect(zeebeEngine.evaluate('=count(items)', { items: [1, 2] })).toEqual({ ok: true, value: 2 })
  })

  it('treats a source without "=" as a static string', () => {
    expect(zeebeEngine.evaluate('gold', {})).toEqual({ ok: true, value: 'gold' })
  })

  it('reports a missing variable instead of returning null', () => {
    expect(zeebeEngine.evaluate('=total > 100', {})).toEqual({ ok: false, reason: "Variable 'total' not found" })
  })

  it('keeps a legitimate null result', () => {
    expect(zeebeEngine.evaluate('=customer.tier', { customer: { tier: null } })).toEqual({ ok: true, value: null })
  })

  it('stores FEEL temporal values as ISO strings, like Zeebe does', () => {
    expect(zeebeEngine.evaluate('=date("2024-01-10")', {})).toEqual({ ok: true, value: '2024-01-10' })
    expect(zeebeEngine.evaluate('={due: duration("P1D")}', {})).toEqual({ ok: true, value: { due: 'P1D' } })
  })

  it('only evaluates conditions written in FEEL', () => {
    expect(zeebeEngine.canEvaluate('${total > 100}')).toBe(false)
    expect(zeebeEngine.canEvaluate('=total > 100')).toBe(true)
  })

  it('writes dotted targets as nested variables', () => {
    expect(zeebeEngine.writeVariable({}, 'order.total', 5)).toEqual({ order: { total: 5 } })
  })

  it('reads the variables a FEEL expression uses, without functions and bound names', () => {
    expect(zeebeEngine.readVariableNames('=creditworthy and count(accessories) > 0')).toEqual([
      'creditworthy',
      'accessories',
    ])
    expect(zeebeEngine.readVariableNames('=customer.id')).toEqual(['customer'])
    expect(zeebeEngine.readVariableNames('=for item in items return item.price')).toEqual(['items'])
    expect(zeebeEngine.readVariableNames('static')).toEqual([])
  })

  it('reports invalid FEEL', () => {
    const evaluation = zeebeEngine.evaluate('=total >', {})

    expect(evaluation.ok).toBe(false)
    expect(zeebeEngine.canEvaluate('=total >')).toBe(false)
    expect(zeebeEngine.canEvaluate('=total > 5')).toBe(true)
  })
})
