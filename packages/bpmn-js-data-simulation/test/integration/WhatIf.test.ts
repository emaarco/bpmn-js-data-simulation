// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { createHarness, type Harness, harnessFor } from './harness'

const fixtures = [
  ['zeebe', 'order-zeebe.bpmn'],
  ['camunda7', 'order-camunda7.bpmn'],
] as const

const smallOrder = { creditworthy: true, orderTotal: 1200, insurance: true, accessories: ['lock'] }
const largeOrder = { creditworthy: true, orderTotal: 8900, insurance: false, accessories: [], approved: true }

describe.each(fixtures)('what-if with %s', (engine, fixture) => {
  it('resolves the path the variables take, without starting an instance', async () => {
    const harness = await harnessFor(fixture, engine)

    const resolution = harness.dataSimulation.resolve(smallOrder)

    expect(resolution.taken).toEqual(
      expect.arrayContaining([
        'Start',
        'Flow_Approved',
        'Task_Ship',
        'Task_Insurance',
        'Task_Accessories',
        'End_Shipped',
      ]),
    )
    expect(resolution.skipped).toEqual(
      expect.arrayContaining(['Flow_Review', 'Task_Review', 'Flow_Rejected', 'End_Rejected', 'Flow_NoExtras']),
    )
    expect(resolution.decisions.Gateway_Credit.takenFlowIds).toEqual(['Flow_Approved'])
    expect(resolution.decisions.Gateway_Extras.takenFlowIds).toEqual(['Flow_Insurance', 'Flow_Accessories'])
    expect(resolution.decisions).not.toHaveProperty('Gateway_Join')
    expect(harness.dataSimulation.getSnapshot()).toMatchObject({ instances: [], log: [] })
  })

  it('marks the path and moves the marks when the variables change', async () => {
    const harness = await harnessFor(fixture, engine)

    harness.dataSimulation.resolve(smallOrder)
    expect(harness.markers('Task_Ship')).toEqual(['bds-path--taken'])
    expect(harness.markers('Task_Review')).toEqual(['bds-path--skipped'])

    harness.dataSimulation.resolve(largeOrder)
    expect(harness.markers('Task_Review')).toEqual(['bds-path--taken'])
    expect(harness.markers('Task_Insurance')).toEqual(['bds-path--skipped'])
  })
})

describe('what-if', () => {
  it('marks a gateway that cannot decide and leaves everything behind it skipped', async () => {
    const harness = await harnessFor('order-zeebe.bpmn', 'zeebe')

    const resolution = harness.dataSimulation.resolve({ creditworthy: true })

    expect(resolution.decisions.Gateway_Credit.stuckReason).toMatch(/Condition of "yes" failed/)
    expect(harness.markers('Gateway_Credit')).toEqual(['bds-path--taken', 'bds-path--stuck'])
    expect(harness.markers('End_Rejected')).toEqual(['bds-path--skipped'])
  })

  it('removes its marks on clearResolution', async () => {
    const harness = await harnessFor('order-zeebe.bpmn', 'zeebe')
    harness.dataSimulation.resolve(smallOrder)

    harness.dataSimulation.clearResolution()

    expect(allMarkers(harness, ['Start', 'Task_Ship', 'Task_Review', 'Flow_Review'])).toEqual([])
  })

  it('sums the measures of the elements on the path', async () => {
    const harness = await createHarness(leadTimeProcess, 'zeebe')
    const leadTime = (fast: boolean) =>
      harness.dataSimulation.resolve({ fast }, { measures: ['sim:duration'] }).measures

    expect(leadTime(true)).toEqual({ 'sim:duration': 3 })
    expect(leadTime(false)).toEqual({ 'sim:duration': 11 })
  })
})

function allMarkers(harness: Harness, ids: string[]): string[] {
  return ids.flatMap(id => harness.markers(id))
}

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
