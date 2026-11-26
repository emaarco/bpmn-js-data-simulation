import { expect, type Page, test } from '@playwright/test'
import { openApp, selectExample, startInstance } from './helpers'

const START_EVENT = 'startEvent_fleetOrderReceived'

function progress(page: Page, elementId: string) {
  return page.locator(`.djs-overlays[data-container-id="${elementId}"] .bds-loop`)
}

function instancesWith(page: Page, elementId: string, status: 'waiting' | 'running' | 'done') {
  return progress(page, elementId).locator(`.bds-loop-dot[data-status="${status}"]`)
}

test.beforeEach(async ({ page }) => {
  await openApp(page)
  await selectExample(page, '/examples/fleet-order.zeebe.bpmn')
})

test('assembles all bikes in parallel, then delivers to one site after the other', async ({ page }) => {
  await startInstance(page, { scenario: 'Four bikes, two sites', startEventId: START_EVENT })

  await expect(progress(page, 'serviceTask_assembleBike')).toBeVisible()
  await expect(
    page.locator('.djs-overlays[data-container-id="serviceTask_assembleBike"] .bts-token-count'),
  ).toHaveCount(0)
  await expect(progress(page, 'serviceTask_assembleBike')).toHaveText('4/4')
  await expect(progress(page, 'serviceTask_assembleBike')).toHaveAttribute(
    'title',
    '4 parallel instances, one per item of =bikes',
  )

  await expect(progress(page, 'subProcess_deliverToSite')).toHaveText('1/2')
  await expect(instancesWith(page, 'subProcess_deliverToSite', 'running')).toHaveCount(1)
  await expect(progress(page, 'subProcess_deliverToSite')).toHaveText('2/2')
  await expect(page.locator('.bds-panel')).toContainText('completed')
})

test('pauses and resumes the instances with the token simulation', async ({ page }) => {
  await startInstance(page, { scenario: 'Four bikes, two sites', startEventId: START_EVENT })
  await expect(progress(page, 'serviceTask_assembleBike')).toBeVisible()
  await page.getByTitle('Play/Pause Simulation').click()

  await expect(instancesWith(page, 'serviceTask_assembleBike', 'running')).toHaveCount(4)
  await page.waitForTimeout(1500)
  await expect(progress(page, 'serviceTask_assembleBike')).toHaveText('0/4')

  await page.getByTitle('Play/Pause Simulation').click()
  await expect(progress(page, 'serviceTask_assembleBike')).toHaveText('4/4')
})

test('skips the assembly when the bike list is empty', async ({ page }) => {
  await startInstance(page, { scenario: 'Bikes already assembled', startEventId: START_EVENT })

  await expect(progress(page, 'serviceTask_assembleBike')).toHaveText('0/0')
  await expect(progress(page, 'serviceTask_assembleBike')).toHaveAttribute('title', 'No instance: =bikes is empty')
  await expect(progress(page, 'subProcess_deliverToSite')).toHaveText('3/3')
})

test('falls back to 3 deliveries without sites and says why', async ({ page }) => {
  await startInstance(page, { scenario: 'Sites missing', startEventId: START_EVENT })

  await expect(progress(page, 'subProcess_deliverToSite')).toHaveText('3/3')
  await expect(page.locator('.bds-issues')).toContainText("Ran 3 instances by default: Variable 'sites' not found")
})

test('clears the progress on reset', async ({ page }) => {
  await startInstance(page, { scenario: 'Four bikes, two sites', startEventId: START_EVENT })
  await expect(progress(page, 'serviceTask_assembleBike')).toBeVisible()

  await page.getByTitle('Reset Simulation').click()
  await expect(progress(page, 'serviceTask_assembleBike')).toHaveCount(0)
})

test('reads the collections in JUEL for Camunda 7', async ({ page }) => {
  await selectExample(page, '/examples/fleet-order.camunda7.bpmn')
  await startInstance(page, { scenario: 'Four bikes, two sites', startEventId: START_EVENT })

  await expect(progress(page, 'serviceTask_assembleBike')).toHaveText('4/4')
  await expect(progress(page, 'subProcess_deliverToSite')).toHaveText('2/2')
})
