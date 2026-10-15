import { expect, test } from '@playwright/test'
import {
  contextPad,
  decision,
  decisionCard,
  element,
  expectReady,
  openApp,
  selectExample,
  openStartDialog,
  startInstance,
  trigger,
  variable,
} from './helpers'

test.beforeEach(async ({ page }) => {
  await openApp(page)
})

test('opens the first example in simulation mode', async ({ page }) => {
  await expect(page.locator('.bds-panel .bds-engine')).toHaveText('Zeebe · FEEL')
  await expect(page.locator('.app-properties')).toBeHidden()
})

test('opens process data from the token simulation palette, like the log', async ({ page }) => {
  const toggle = page.getByRole('button', { name: 'Toggle Process Data' })
  await expect(toggle).toHaveClass(/active/)

  await page.locator('.bds-panel').getByRole('button', { name: 'Close' }).click()
  await expect(page.locator('.bds-panel')).toBeHidden()
  await expect(toggle).not.toHaveClass(/active/)

  await toggle.click()
  await expect(page.locator('.bds-panel')).toBeVisible()
})

test('keeps its look under a host theme that styles paragraphs, tables and code', async ({ page }) => {
  await page.addStyleTag({
    content: `#canvas p, #canvas li { font-size: 40px !important; }
      #canvas table, #canvas th, #canvas td { padding: 30px; border: 3px solid red; }
      #canvas code { background: yellow; padding: 10px; }`,
  })
  await startInstance(page)

  const hint = page.locator('.bds-instance-body .bds-hint').last()
  await expect(hint).toHaveCSS('font-size', '12px')
  await expect(variable(page, 'orderTotal').locator('td')).toHaveCSS('border-top-width', '0px')
  await expect(variable(page, 'orderTotal').locator('code')).toHaveCSS('padding-top', '0px')
})

test('keeps the start button in view on a low canvas', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 420 })
  await openStartDialog(page)

  await expect(page.getByRole('button', { name: 'Start instance' })).toBeInViewport()
})

test('switches back to the plain token simulation and on again', async ({ page }) => {
  const dataToggle = page.getByRole('button', { name: 'Data Simulation' })
  await expect(dataToggle).toHaveAttribute('aria-pressed', 'true')

  await dataToggle.click()
  await expect(dataToggle).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByRole('button', { name: 'Toggle Process Data' })).toBeHidden()
  await expect(contextPad(page, 'Gateway_Credit', 'Set Sequence Flow')).toHaveCount(1)
  await trigger(page, 'Start')
  await expect(page.locator('.bts-notification', { hasText: 'Process finished' }).first()).toBeVisible()
  await expect(page.locator('.bds-dialog')).toHaveCount(0)
  await expect(page.locator('.bds-gateway--decided')).toHaveCount(0)

  await dataToggle.click()
  await expect(contextPad(page, 'Gateway_Credit', 'Set Sequence Flow')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Toggle Process Data' })).toBeVisible()
  await openStartDialog(page)
})

test('keeps a stuck gateway card readable on a low, zoomed-out canvas', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 420 })
  await startInstance(page, { scenario: 'Order total missing' })
  await page.evaluate(() => {
    const editor = (window as unknown as { __editor: { modeler: { get(name: string): any } } }).__editor
    const gateway = editor.modeler.get('elementRegistry').get('Gateway_Credit')
    editor.modeler.get('canvas').zoom(0.5, { x: gateway.x, y: gateway.y })
  })

  const card = await decision(page, 'Gateway_Credit')
  await expect(card.locator('.bds-error')).toBeInViewport()
  expect((await card.boundingBox())?.width).toBe(300)
})

test('sits next to a resized token simulation toggle', async ({ page }) => {
  await page.addStyleTag({ content: '.bts-toggle-mode { font-size: 12px; }' })
  const tokenToggle = page.locator('.bts-toggle-mode')
  const dataToggle = page.getByRole('button', { name: 'Data Simulation' })

  await expect(dataToggle).toHaveCSS('font-size', '12px')
  const token = (await tokenToggle.boundingBox())!
  const data = (await dataToggle.boundingBox())!
  expect(data.x).toBeCloseTo(token.x + token.width + 8, 0)
  expect(data.y + data.height / 2).toBeCloseTo(token.y + token.height / 2, 0)
})

test('asks for the start variables the process reads when starting', async ({ page }) => {
  await openStartDialog(page)

  await expect(page.locator('.bds-dialog .bds-scenario-select option')).toHaveCount(5)
  await expect(page.locator('.bds-dialog .bds-scenario-select')).toHaveValue('small-order')
  await expect(page.locator('.bds-dialog .bds-field-name')).toHaveText([
    'customer',
    'orderTotal',
    'approved',
    'insurance',
    'accessories',
  ])
  await expect(page.locator('.bds-dialog [name="orderTotal"]')).toHaveValue('1290')

  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.locator('.bds-dialog')).toHaveCount(0)
  await expect(page.locator('.bds-instance-body')).toContainText('Press ▶ on a start event')
})

test('runs a scenario: output mappings write variables, gateways follow the data', async ({ page }) => {
  await startInstance(page)

  await expect(page.locator('.bds-status--completed')).toBeVisible()
  await expect(variable(page, 'creditScore')).toContainText('720')
  await expect(variable(page, 'creditworthy')).toContainText('true')
  await expect((await decision(page, 'Gateway_Credit')).locator('.bds-flow--taken')).toHaveText(/yes/)
  await expect((await decision(page, 'Gateway_Extras')).locator('.bds-flow--taken')).toHaveCount(2)
  await expect(page.locator('.djs-overlay-bds-flow-outcome .bds-outcome--taken').first()).toBeVisible()
})

test('takes the default flow when no condition is true', async ({ page }) => {
  await startInstance(page, { scenario: 'Bad credit' })

  await expect(page.locator('.bds-status--completed')).toBeVisible()
  await expect((await decision(page, 'Gateway_Credit')).locator('.bds-flow--taken')).toHaveText(/no/)
})

test('stops at a failing condition and continues after the instance variables are fixed', async ({ page }) => {
  await startInstance(page, { scenario: 'Order total missing' })

  await expect(element(page, 'Gateway_Credit')).toHaveClass(/bds-gateway--stuck/)
  await expect(decisionCard(page, 'Gateway_Credit')).toHaveCount(0)
  await expect(await decision(page, 'Gateway_Credit')).toContainText("Variable 'orderTotal' not found")
  await expect(decisionCard(page, 'Gateway_Credit').locator('.bds-decision-inputs')).toContainText('orderTotalnot set')

  await page.locator('.bds-instance').getByRole('button', { name: 'Edit' }).click()
  const editor = page.locator('.bds-instance-editor')
  const variables = JSON.parse(await editor.inputValue())
  await editor.fill(JSON.stringify({ ...variables, orderTotal: 450 }))
  await page.getByRole('button', { name: 'Apply' }).click()
  await trigger(page, 'Gateway_Credit')

  await expect(page.locator('.bds-status--completed')).toBeVisible()
  await expect(page.locator('.bds-gateway--stuck')).toHaveCount(0)
  await expect(element(page, 'Gateway_Credit')).toHaveClass(/bds-gateway--decided/)
})

test('starts with values set on demand on top of a scenario', async ({ page }) => {
  await startInstance(page, { values: { orderTotal: '9000' } })

  await expect((await decision(page, 'Gateway_Credit')).locator('.bds-flow--taken')).toHaveText(/large order/)
  await expect(await decision(page, 'Gateway_Approved')).toContainText("Variable 'approved' not found")
})

test('keeps a decision card open when its gateway is clicked', async ({ page }) => {
  await startInstance(page)
  await element(page, 'Gateway_Credit').click()
  await element(page, 'Task_Ship').hover()

  await expect(decisionCard(page, 'Gateway_Credit')).toContainText('orderTotal1290')
  await decisionCard(page, 'Gateway_Credit').getByRole('button', { name: 'Close' }).click()
  await expect(decisionCard(page, 'Gateway_Credit')).toHaveCount(0)
})

test('rejects invalid start variables', async ({ page }) => {
  await openStartDialog(page)
  await page.locator('.bds-dialog [name="accessories"]').fill('[')
  await page.getByRole('button', { name: 'Start instance' }).click()

  await expect(page.locator('.bds-dialog .bds-error')).toHaveText('accessories must be valid JSON')
})

test('hides the click-to-choose pad on gateways driven by data', async ({ page }) => {
  await expect(contextPad(page, 'Gateway_Credit', 'Set Sequence Flow')).toHaveCount(0)
  await expect(contextPad(page, 'Gateway_Extras', 'Set Sequence Flow')).toHaveCount(0)
})

test('evaluates JUEL for Camunda 7', async ({ page }) => {
  await selectExample(page, '/examples/bike-order.camunda7.bpmn')
  await expect(page.locator('.bds-panel .bds-engine')).toHaveText('Camunda 7 · JUEL')
  await startInstance(page)

  await expect(page.locator('.bds-status--completed')).toBeVisible()
  await expect(variable(page, 'creditworthy')).toContainText('true')
  await expect(await decision(page, 'Gateway_Credit')).toContainText('${creditworthy && orderTotal <= 5000}')
})

test('runs Camunda 7 from scratch without a scenario', async ({ page }) => {
  await selectExample(page, '/examples/bike-order.camunda7.bpmn')
  await openStartDialog(page)
  await page.locator('.bds-dialog .bds-scenario-select').selectOption({ label: 'No scenario' })
  await page.locator('.bds-dialog [name="customer"]').fill('{ "id": "C-1" }')
  await page.locator('.bds-dialog [name="orderTotal"]').fill('450')
  await page.locator('.bds-dialog [name="accessories"]').fill('[]')
  await page.locator('.bds-dialog [name="score"]').fill('720')
  await page.getByRole('button', { name: 'Start instance' }).click()

  await expect(page.locator('.bds-status--completed')).toBeVisible()
  await expect(variable(page, 'creditworthy')).toContainText('true')
})

test('falls back to the click for conditions the engine cannot evaluate', async ({ page }) => {
  await selectExample(page, '/examples/return-handling.camunda7.bpmn')

  await expect(contextPad(page, 'Gateway_Condition', 'Set Sequence Flow')).toHaveCount(1)
  await expect(contextPad(page, 'Gateway_Window', 'Set Sequence Flow')).toHaveCount(0)

  await startInstance(page)
  await expect(page.locator('.bds-status--completed')).toBeVisible()
  await expect((await decision(page, 'Gateway_Window')).locator('.bds-tag').first()).toHaveText('exclusive')
  await expect((await decision(page, 'Gateway_Condition')).locator('.bds-tag').first()).toHaveText(
    'exclusive · by click',
  )
})

test('reopens the selected example after a reload', async ({ page }) => {
  await selectExample(page, '/examples/bike-service.zeebe.bpmn')
  await page.reload()

  await expectReady(page)
  await openStartDialog(page)
  await expect(page.locator('.bds-dialog-header')).toContainText('Start “Bike service”')
})

test('restores model and scenarios from a shared link', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await selectExample(page, '/examples/bike-service.zeebe.bpmn')
  await page.locator('#btn-menu').click()
  await page.locator('#btn-share').click()
  await expect(page.locator('#toast')).toHaveText('Link in die Zwischenablage kopiert')
  const sharedUrl = await page.evaluate(() => navigator.clipboard.readText())
  expect(sharedUrl).toContain('#bpmn=')

  await page.goto('about:blank')
  await page.goto(sharedUrl)
  await expect(page.getByTestId('status')).toHaveAttribute('data-state', 'ready')
  await page.locator('.bjs-container .bts-toggle-mode').click()
  await openStartDialog(page)
  await expect(page.locator('.bds-dialog .bds-scenario-select')).toHaveValue('full-service')
})

test('keeps the start pads when switching between examples of the same engine', async ({ page }) => {
  await selectExample(page, '/examples/bike-service.zeebe.bpmn')

  await expect(contextPad(page, 'Start', 'Trigger Event')).toBeVisible()
})

test('follows a newly started instance and shows only its badges', async ({ page }) => {
  await startInstance(page)
  await expect(page.locator('.bds-status--completed')).toBeVisible()
  await startInstance(page, { scenario: 'Bad credit' })

  await expect(page.locator('.bds-instance-select')).toHaveValue(/.+/)
  await expect(page.locator('.bds-instance-select option:checked')).toHaveText(/#2 Bad credit/)
  await expect(page.locator('.djs-overlays[data-container-id="Flow_Insurance"] .bds-outcome')).toHaveCount(0)
})

test('opens a new diagram in edit mode with the properties panel', async ({ page }) => {
  await page.locator('#btn-menu').click()
  await page.locator('#btn-new').click()
  await expect(page.getByTestId('status')).toHaveAttribute('data-state', 'ready')

  await expect(page.locator('.app-properties')).toBeVisible()
  await expect(page.locator('.bds-panel')).toBeHidden()
})
