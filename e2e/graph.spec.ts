import { expect, test } from '@playwright/test'

test('switches graph granularity and toggles series accessibly', async ({ page }) => {
  await page.goto('./?calculator=home')
  await page.getByRole('heading', { name: 'Payment trajectory' }).scrollIntoViewIfNeeded()
  const graph = page.locator('.payment-graph')
  await expect(graph.locator('[data-period]')).not.toHaveCount(0)
  const yearlyCount = await graph.locator('[data-period]').count()
  await page.getByRole('button', { name: 'Monthly graph' }).click()
  expect(await graph.locator('[data-period]').count()).toBeGreaterThan(yearlyCount)
  await page.getByRole('button', { name: 'Hide interest' }).click()
  await expect(page.getByRole('button', { name: 'Show interest' })).toBeVisible()
  await expect(graph.locator('[data-series="interest"]')).toHaveCount(0)
})

test('links focused graph periods with the schedule', async ({ page }) => {
  await page.goto('./?calculator=home')
  await page.getByRole('heading', { name: 'Payment trajectory' }).scrollIntoViewIfNeeded()
  const period = page.getByRole('button', { name: /2030 payment details/i })
  await period.focus()
  await expect(page.getByRole('tooltip')).toContainText('2030')
  await expect(page.locator('.year-list details').filter({ hasText: '2030' })).not.toHaveAttribute('open', '')
  await page.keyboard.press('Enter')
  await expect(page.locator('.year-list details').filter({ hasText: '2030' })).toHaveAttribute('open', '')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('tooltip')).toHaveCount(0)
})

test('shows period details inside the graph with x and y guides', async ({ page }) => {
  await page.goto('./?calculator=home')
  await page.getByRole('heading', { name: 'Payment trajectory' }).scrollIntoViewIfNeeded()
  const graph = page.locator('.payment-graph')
  const period = page.getByRole('button', { name: /2030 payment details/i })

  await period.hover()
  const tooltip = graph.locator('svg [role="tooltip"]')
  await expect(tooltip).toBeVisible()
  await expect(tooltip).toContainText('2030')
  await expect(tooltip).toContainText('Closing balance')
  await expect(graph.locator('.graph-crosshair')).toHaveCount(2)
  await expect(graph.locator('.graph-active-point')).toHaveCount(1)
  await expect(graph.locator(':scope > .graph-tooltip')).toHaveCount(0)
  const tooltipOpacity = await tooltip.evaluate((element) => ({
    background: Number.parseFloat(getComputedStyle(element.querySelector('.graph-tooltip-box')!).fillOpacity),
    title: Number.parseFloat(getComputedStyle(element.querySelector('.graph-tooltip-title')!).opacity),
    values: Number.parseFloat(getComputedStyle(element.querySelector('.graph-tooltip-line')!).opacity),
  }))
  expect(tooltipOpacity.background).toBeGreaterThanOrEqual(.88)
  expect(tooltipOpacity.background).toBeLessThanOrEqual(.92)
  expect(tooltipOpacity.title).toBe(1)
  expect(tooltipOpacity.values).toBe(1)

  await page.mouse.move(0, 0)
  await expect(tooltip).toHaveCount(0)
  await expect(graph.locator('.graph-crosshair')).toHaveCount(0)
})

test('supports visible range and OD comparison controls', async ({ page }) => {
  await page.goto('./?calculator=home')
  await page.getByRole('heading', { name: 'Payment trajectory' }).scrollIntoViewIfNeeded()
  const first = page.getByLabel('First visible period')
  const last = page.getByLabel('Last visible period')
  await expect(first).toBeVisible()
  await expect(last).toBeVisible()
  await first.fill('2')
  await last.fill('5')
  await expect(page.locator('.payment-graph [data-period]')).toHaveCount(4)
  await page.getByRole('button', { name: 'Compare OD balance' }).click()
  await expect(page.getByRole('button', { name: 'Compare OD balance' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.od-balance-line')).toHaveCount(1)
})
