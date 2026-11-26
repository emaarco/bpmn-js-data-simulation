import { expect, test } from '@playwright/test'
import { element } from './helpers'

test.beforeEach(async ({ page }) => {
  await page.goto('/path-simulation.html')
})

test('marks the path in a plain viewer, without the token simulation', async ({ page }) => {
  await expect(element(page, 'serviceTask_ship')).toHaveClass(/bds-path--taken/)
  await expect(element(page, 'userTask_review')).toHaveClass(/bds-path--skipped/)
  await expect(page.locator('.bts-toggle-mode')).toHaveCount(0)
})

test('moves the path when the slider crosses a condition', async ({ page }) => {
  await page.locator('#order-total').fill('6800')

  await expect(element(page, 'userTask_review')).toHaveClass(/bds-path--taken/)
})
