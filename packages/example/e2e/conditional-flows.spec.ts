import { expect, test } from '@playwright/test'
import { decision, element, openApp, selectExample, startInstance, trigger } from './helpers'

const BIKE_REPAIR = '/examples/bike-repair.camunda7-conditional-flows.bpmn'

test.beforeEach(async ({ page }) => {
  await openApp(page)
  await selectExample(page, BIKE_REPAIR)
})

test('routes conditional flows on a task like the inclusive gateway next to it', async ({ page }) => {
  await startInstance(page, { scenario: 'Brakes and tires worn', startEventId: 'startEvent_bikeHandedIn' })

  await expect(page.locator('.bds-status--completed')).toBeVisible()
  await expect(element(page, 'userTask_inspectBike')).toHaveClass(/bds-gateway--decided/)
  const onTask = await decision(page, 'userTask_inspectBike')
  await expect(onTask.locator('.bds-tag').first()).toHaveText('conditional flows')
  await expect(onTask.locator('.bds-flow--taken')).toHaveText([/brakes worn/, /tires worn/])

  await startInstance(page, { scenario: 'Brakes and tires worn', startEventId: 'startEvent_bikeHandedInWithGateway' })

  await expect(page.locator('.bds-status--completed')).toBeVisible()
  const atGateway = await decision(page, 'gateway_partsNeeded')
  await expect(atGateway.locator('.bds-flow--taken')).toHaveText([/brakes worn/, /tires worn/])
})

test('keeps the token at the task when a condition fails and continues after the data is fixed', async ({ page }) => {
  await startInstance(page, { scenario: 'Inspection incomplete', startEventId: 'startEvent_bikeHandedIn' })

  await expect(element(page, 'userTask_inspectBike')).toHaveClass(/bds-gateway--stuck/)
  await expect(await decision(page, 'userTask_inspectBike')).toContainText('press ▶ on the activity')

  await page.locator('.bds-instance').getByRole('button', { name: 'Edit' }).click()
  const editor = page.locator('.bds-instance-editor')
  const variables = JSON.parse(await editor.inputValue())
  await editor.fill(JSON.stringify({ ...variables, tiresWorn: false }))
  await page.getByRole('button', { name: 'Apply' }).click()
  await trigger(page, 'userTask_inspectBike')

  await expect(page.locator('.bds-status--completed')).toBeVisible()
  await expect(element(page, 'userTask_inspectBike')).toHaveClass(/bds-gateway--decided/)
  await expect((await decision(page, 'userTask_inspectBike')).locator('.bds-flow--taken')).toHaveText([/brakes worn/])
})
