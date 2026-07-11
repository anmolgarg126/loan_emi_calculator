import { expect, test, type Page } from '@playwright/test'

const monitorPage = (page: Page) => {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`)
  })
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`))
  return errors
}

const expectHealthyPage = async (page: Page, errors: string[]) => {
  const origin = new URL(page.url()).origin
  const resources = await page.evaluate(() => performance.getEntriesByType('resource').map(({ name }) => name))
  expect(resources.filter((url) => !url.startsWith(origin))).toEqual([])
  expect(errors).toEqual([])
}

test('marks valid share provenance and clears it on reset', async ({ page }) => {
  const errors = monitorPage(page)
  await page.goto('./#v1=eyJhbm51YWxSYXRlIjo4LjI1fQ')
  await expect(page.getByText(/Loaded from a shared link/)).toBeVisible()
  await expect(page.locator('#interest-rate')).toHaveValue('8.25')
  await page.getByRole('button', { name: 'Reset' }).click()
  await expect(page.getByText(/Loaded from a shared link/)).toHaveCount(0)
  await expectHealthyPage(page, errors)
})

test('round-trips a generated fragment in a new browser context', async ({ page, browser, baseURL }) => {
  const errors = monitorPage(page)
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: async (url: string) => { document.documentElement.dataset.sharedUrl = url } },
      configurable: true,
    })
  })
  await page.goto('./')
  await page.locator('#home-value').fill('7654321')
  await page.getByRole('button', { name: 'Copy share link' }).click()
  const url = await page.locator('html').getAttribute('data-shared-url')
  expect(url).toContain('#v1=')

  const context = await browser.newContext()
  const sharedPage = await context.newPage()
  const sharedErrors = monitorPage(sharedPage)
  await sharedPage.goto(url!.replace(new URL(url!).origin, new URL(baseURL!).origin))
  await expect(sharedPage.locator('#home-value')).toHaveValue('7654321')
  await expect(sharedPage.getByText(/Loaded from a shared link/)).toBeVisible()
  await expectHealthyPage(sharedPage, sharedErrors)
  await context.close()
  await expectHealthyPage(page, errors)
})

test('recovers from malformed state, shows inline issues, disables actions, and resets', async ({ page }) => {
  const errors = monitorPage(page)
  await page.goto('./#v1=eyJyYXRlQ2hhbmdlcyI6W251bGxdfQ')
  await expect(page.getByText(/shared scenario link was invalid/i)).toBeVisible()
  await page.locator('#home-value').fill('0')
  await expect(page.locator('#home-value')).toHaveAttribute('aria-invalid', 'true')
  await expect(page.locator('#home-value-error')).toContainText('Home value must be above')
  for (const name of ['Copy share link', 'Print / Save PDF', 'Download CSV', 'Download Excel']) {
    await expect(page.getByRole('button', { name })).toBeDisabled()
  }
  await page.getByRole('button', { name: 'Reset' }).evaluate((button: HTMLButtonElement) => button.click())
  await expect(page.locator('#home-value')).toHaveValue('5000000')
  await expect(page.getByRole('button', { name: 'Copy share link' })).toBeEnabled()
  await expectHealthyPage(page, errors)
})

test('caps OD rows at 100 and rejects withdrawals above parked liquidity', async ({ page }) => {
  const errors = monitorPage(page)
  await page.goto('./')
  await page.getByText('Overdraft facility', { exact: true }).click()
  await page.locator('#od-enabled').check()
  await page.locator('#od-transactions').check()
  const addTransaction = page.getByRole('button', { name: 'Add OD transaction' })
  for (let index = 0; index < 100; index += 1) await addTransaction.click()
  const rows = page.locator('.od-fields .entry-row')
  await expect(rows).toHaveCount(100)
  await expect(page.getByRole('button', { name: 'Add OD transaction' })).toBeDisabled()

  await rows.first().getByLabel('Type').selectOption('withdrawal')
  await rows.first().getByLabel('Amount').fill('1')
  await expect(page.getByText(/exceeds the available parked surplus/i)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Copy share link' })).toBeDisabled()
  await page.getByRole('button', { name: 'Reset' }).evaluate((button: HTMLButtonElement) => button.click())
  await expect(page.locator('.od-fields .entry-row')).toHaveCount(0)
  await expectHealthyPage(page, errors)
})
