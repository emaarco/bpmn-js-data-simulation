import { describe, expect, it } from 'vitest'
import { Camunda7Engine } from '../../src/engines/camunda7/Camunda7Engine'
import type { ModdleElement } from '../../src/engines/types'
import { loadFlowElements } from './moddle'

const camunda7Engine = new Camunda7Engine()

describe('Camunda7Engine', () => {
  it('reads camunda:inputOutput parameters', async () => {
    const elements = await loadFlowElements('order-camunda7.bpmn', 'camunda7')
    const task = elements.get('Task_CheckCredit')!

    expect(camunda7Engine.readIoMappings(task)).toEqual({
      inputs: [{ source: '${customer.id}', target: 'customerId' }],
      outputs: [
        { source: '${score}', target: 'creditScore' },
        { source: '${score ge 600}', target: 'creditworthy' },
      ],
    })
  })

  it('reads JUEL conditions and ignores script conditions', async () => {
    const elements = await loadFlowElements('order-camunda7.bpmn', 'camunda7')
    const scriptFlow = {
      $type: 'bpmn:SequenceFlow',
      conditionExpression: { $type: 'bpmn:FormalExpression', language: 'javascript', body: 'true' },
    } as ModdleElement

    expect(camunda7Engine.readCondition(elements.get('Flow_Approved')!)).toBe('${creditworthy && orderTotal <= 5000}')
    expect(camunda7Engine.readCondition(scriptFlow)).toBeUndefined()
  })

  it('evaluates JUEL and treats an empty parameter as null', () => {
    expect(camunda7Engine.evaluate('${total > 100}', { total: 150 })).toEqual({ ok: true, value: true })
    expect(camunda7Engine.evaluate('', {})).toEqual({ ok: true, value: null })
    expect(camunda7Engine.evaluate('${missing}', {})).toEqual({
      ok: false,
      reason: 'Unknown property used in expression: missing',
    })
  })

  it('writes targets as flat variable names', () => {
    expect(camunda7Engine.writeVariable({}, 'order.total', 5)).toEqual({ 'order.total': 5 })
  })

  it('reads the variables a JUEL expression uses', () => {
    expect(camunda7Engine.readVariableNames('${creditworthy && customer.tier == "gold" ? a : b}')).toEqual([
      'creditworthy',
      'customer',
      'a',
      'b',
    ])
    expect(camunda7Engine.readVariableNames('${broken')).toEqual([])
  })

  it('knows which expressions it can evaluate', () => {
    expect(camunda7Engine.canEvaluate('${total > 100}')).toBe(true)
    expect(camunda7Engine.canEvaluate('${execution.getVariable("total") > 100}')).toBe(false)
  })
})
