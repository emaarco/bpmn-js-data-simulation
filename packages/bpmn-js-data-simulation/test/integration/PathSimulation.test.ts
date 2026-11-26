// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { camunda7Engine, zeebeEngine } from '../../src'
import { readFixture } from '../engines/moddle'
import { createPathSimulationHarness, type PathSimulationHarness } from './harness'

const fixtures = [
  ['zeebe', 'order-zeebe.bpmn'],
  ['camunda7', 'order-camunda7.bpmn'],
] as const

const smallOrder = { creditworthy: true, orderTotal: 1200, insurance: true, accessories: ['lock'] }
const largeOrder = { creditworthy: true, orderTotal: 8900, insurance: false, accessories: [], approved: true }

function harnessFor(fixture: string, engine: 'zeebe' | 'camunda7'): Promise<PathSimulationHarness> {
  return createPathSimulationHarness(readFixture(fixture), engine)
}

describe.each(fixtures)('path simulation with %s, without the token simulation', (engine, fixture) => {
  it('simulates the path the variables take', async () => {
    const { pathSimulation } = await harnessFor(fixture, engine)

    const path = pathSimulation.simulate(smallOrder)

    expect(path.taken).toEqual(
      expect.arrayContaining([
        'startEvent_orderReceived',
        'flow_approved',
        'serviceTask_ship',
        'serviceTask_insurance',
        'serviceTask_accessories',
        'endEvent_shipped',
      ]),
    )
    expect(path.skipped).toEqual(
      expect.arrayContaining(['flow_review', 'userTask_review', 'flow_rejected', 'endEvent_rejected', 'flow_noExtras']),
    )
    expect(path.decisions.gateway_credit.takenFlowIds).toEqual(['flow_approved'])
    expect(path.decisions.gateway_extras.takenFlowIds).toEqual(['flow_insurance', 'flow_accessories'])
    expect(path.decisions).not.toHaveProperty('gateway_join')
  })

  it('marks the path and moves the marks when the variables change', async () => {
    const { pathSimulation, markers } = await harnessFor(fixture, engine)

    pathSimulation.simulate(smallOrder)
    expect(markers('serviceTask_ship')).toEqual(['bds-path--taken'])
    expect(markers('userTask_review')).toEqual(['bds-path--skipped'])

    pathSimulation.simulate(largeOrder)
    expect(markers('userTask_review')).toEqual(['bds-path--taken'])
    expect(markers('serviceTask_insurance')).toEqual(['bds-path--skipped'])
  })

  it('exposes the configured engine', async () => {
    const { pathSimulation } = await harnessFor(fixture, engine)

    expect(pathSimulation.getEngine()).toBe(engine === 'zeebe' ? zeebeEngine : camunda7Engine)
  })
})

describe('path simulation', () => {
  it('marks a gateway that cannot decide and leaves everything behind it skipped', async () => {
    const { pathSimulation, markers } = await harnessFor('order-zeebe.bpmn', 'zeebe')

    const path = pathSimulation.simulate({ creditworthy: true })

    expect(path.decisions.gateway_credit.stuckReason).toMatch(/Condition of "yes" failed/)
    expect(markers('gateway_credit')).toEqual(['bds-path--taken', 'bds-path--stuck'])
    expect(markers('endEvent_rejected')).toEqual(['bds-path--skipped'])
  })

  it('removes its marks on clear', async () => {
    const { pathSimulation, markers } = await harnessFor('order-zeebe.bpmn', 'zeebe')
    pathSimulation.simulate(smallOrder)

    pathSimulation.clear()

    expect(['startEvent_orderReceived', 'serviceTask_ship', 'userTask_review', 'flow_review'].flatMap(markers)).toEqual(
      [],
    )
  })

  it('sums the measures of the elements on the path', async () => {
    const { pathSimulation } = await createPathSimulationHarness(leadTimeProcess, 'zeebe')
    const leadTime = (fast: boolean) => pathSimulation.simulate({ fast }, { measures: ['sim:duration'] }).measures

    expect(leadTime(true)).toEqual({ 'sim:duration': 3 })
    expect(leadTime(false)).toEqual({ 'sim:duration': 11 })
  })
})

const leadTimeProcess = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:sim="https://example.com/sim" id="Definitions_LeadTime" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_LeadTime" isExecutable="true">
    <bpmn:startEvent id="Start" />
    <bpmn:sequenceFlow id="Flow_Start" sourceRef="Start" targetRef="Task_Prepare" />
    <bpmn:task id="Task_Prepare" sim:duration="1" />
    <bpmn:sequenceFlow id="Flow_ToGateway" sourceRef="Task_Prepare" targetRef="Gateway_Fast" />
    <bpmn:exclusiveGateway id="Gateway_Fast" default="Flow_Slow" />
    <bpmn:sequenceFlow id="Flow_Fast" sourceRef="Gateway_Fast" targetRef="Task_Express">
      <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">=fast</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="Flow_Slow" sourceRef="Gateway_Fast" targetRef="Task_Standard" />
    <bpmn:task id="Task_Express" sim:duration="2" />
    <bpmn:task id="Task_Standard" sim:duration="10" />
    <bpmn:sequenceFlow id="Flow_ExpressDone" sourceRef="Task_Express" targetRef="End" />
    <bpmn:sequenceFlow id="Flow_StandardDone" sourceRef="Task_Standard" targetRef="End" />
    <bpmn:endEvent id="End" />
  </bpmn:process>
</bpmn:definitions>`
