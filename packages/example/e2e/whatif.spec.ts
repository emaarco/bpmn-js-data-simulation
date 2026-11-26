import { expect, test } from '@playwright/test'
import { element, openApp } from './helpers'

test.beforeEach(async ({ page }) => {
  await openApp(page)
  await page.getByRole('button', { name: 'What-if' }).click()
})

test('marks the path the variables take, without the token simulation', async ({ page }) => {
  await expect(page.getByTestId('whatif-panel')).toBeVisible()
  await expect(page.locator('.app-properties')).toBeHidden()
  await expect(page.locator('.bds-panel')).toBeHidden()
  await expect(element(page, 'Task_Ship')).toHaveClass(/bds-path--taken/)
  await expect(element(page, 'Task_Review')).toHaveClass(/bds-path--skipped/)
})

test('moves the path as soon as a value crosses a condition', async ({ page }) => {
  await page.locator('.app-whatif input[name="orderTotal"]').fill('6800')

  await expect(element(page, 'Task_Review')).toHaveClass(/bds-path--taken/)
  await expect(page.getByTestId('whatif-decisions')).toContainText('large order')

  await page.locator('.app-whatif input[name="creditworthy"]').uncheck()

  await expect(element(page, 'End_Rejected')).toHaveClass(/bds-path--taken/)
  await expect(element(page, 'Task_Review')).toHaveClass(/bds-path--skipped/)
})

test('steps aside when the token simulation is switched on', async ({ page }) => {
  await page.locator('.bts-toggle-mode').click()

  await expect(page.getByTestId('whatif-panel')).toBeHidden()
  await expect(page.locator('.bds-path--taken, .bds-path--skipped')).toHaveCount(0)
})
