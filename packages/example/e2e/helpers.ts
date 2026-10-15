import { expect, type Page } from '@playwright/test'

export async function openApp(page: Page): Promise<void> {
  await page.goto('/')
  await expectReady(page)
}

export async function expectReady(page: Page): Promise<void> {
  await expect(page.getByTestId('status')).toHaveAttribute('data-state', 'ready')
  await page.getByRole('button', { name: 'Toggle Process Data' }).click()
  await expect(page.locator('.bds-panel')).toBeVisible()
  await page.evaluate(() => {
    const editor = (window as unknown as { __editor: { modeler: { get(name: string): any } } }).__editor
    editor.modeler.get('animation').setAnimationSpeed(5)
  })
}

export async function selectExample(page: Page, value: string): Promise<void> {
  await page.locator('#btn-menu').click()
  await page.getByTestId('file-picker').selectOption(value)
  await expectReady(page)
}

export async function openStartDialog(page: Page, startEventId = 'Start'): Promise<void> {
  await trigger(page, startEventId)
  await expect(page.locator('.bds-dialog')).toBeVisible()
}

export async function startInstance(
  page: Page,
  { scenario, values = {} }: { scenario?: string; values?: Record<string, string> } = {},
): Promise<void> {
  await openStartDialog(page)
  if (scenario) await page.locator('.bds-dialog .bds-scenario-select').selectOption({ label: scenario })
  for (const [name, value] of Object.entries(values)) await page.locator(`.bds-dialog [name="${name}"]`).fill(value)
  await page.getByRole('button', { name: 'Start instance' }).click()
  await expect(page.locator('.bds-dialog')).toHaveCount(0)
}

export function contextPad(page: Page, elementId: string, title: string) {
  return page.locator(`.djs-overlays[data-container-id="${elementId}"] .bts-context-pad[title="${title}"]`)
}

export async function trigger(page: Page, elementId: string): Promise<void> {
  await contextPad(page, elementId, 'Trigger Event').click()
}

export function variable(page: Page, name: string) {
  return page.locator('.bds-variables tr').filter({ has: page.locator('th', { hasText: new RegExp(`^${name}$`) }) })
}

export function decisionCard(page: Page, gatewayId: string) {
  return page.locator(`.bds-popover[data-element-id="${gatewayId}"]`)
}

export function element(page: Page, elementId: string) {
  return page.locator(`.djs-element[data-element-id="${elementId}"]`)
}

export async function decision(page: Page, gatewayId: string) {
  await element(page, gatewayId).hover()
  return decisionCard(page, gatewayId)
}
