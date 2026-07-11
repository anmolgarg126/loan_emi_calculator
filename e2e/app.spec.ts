import { expect, test } from '@playwright/test'

test('calculates, models OD, shares, exports, and adapts to mobile', async ({ page }) => {
  const browserErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text())
  })
  page.on('pageerror', (error) => browserErrors.push(error.message))
  await page.goto('./')
  await expect(page.getByRole('heading', { name: /Know the loan/i })).toBeVisible()
  await expect(page.getByText('₹35,989', { exact: false }).first()).toBeVisible()

  await page.getByText('Interest-rate changes').click()
  await page.getByRole('button', { name: 'Add rate change' }).click()
  await page.getByLabel('Adjustment').selectOption('keep-tenure')

  await page.getByText('Overdraft facility').click()
  await page.getByLabel('Model an OD-linked home loan').check()
  await page.getByLabel('Opening parked surplus').fill('1000000')
  await page.getByLabel('Dated deposits and withdrawals').check()
  await page.getByRole('button', { name: 'Add OD transaction' }).click()
  await expect(page.getByText(/SAVE ₹/)).toBeVisible()

  await page.getByRole('button', { name: 'Copy share link' }).click()
  await expect(page.getByText(/Share link copied/)).toBeVisible()

  const csvDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download CSV' }).click()
  await expect(csvDownload).resolves.toBeTruthy()

  const xlsxDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download Excel' }).click()
  await expect(xlsxDownload).resolves.toBeTruthy()

  await page.evaluate(() => {
    window.print = () => { document.documentElement.dataset.printed = 'true' }
  })
  await page.getByRole('button', { name: 'Print / Save PDF' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-printed', 'true')

  await page.setViewportSize({ width: 375, height: 812 })
  await expect(page.getByRole('heading', { name: 'Build your scenario' })).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(overflow).toBe(false)
  expect(browserErrors).toEqual([])
})
