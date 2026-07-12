import { expect, test } from '@playwright/test'

test('loads compatible v1 Home links and clears provenance on reset', async ({ page }) => {
  await page.goto('./#v1=eyJhbm51YWxSYXRlIjo4LjI1fQ')
  await expect(page.getByText(/Loaded from a shared link/).first()).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Home' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('#interest-rate')).toHaveValue('8.25')
  await page.getByRole('button', { name: 'Reset calculator' }).click()
  await expect(page.getByText(/Loaded from a shared link/)).toHaveCount(0)
})

test('round-trips a generated v2 fragment in a new browser context', async ({ page, browser, baseURL }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: async (url: string) => { document.documentElement.dataset.sharedUrl = url } },
      configurable: true,
    })
  })
  await page.goto('./?calculator=car')
  await page.getByLabel('Vehicle price').fill('7654321')
  await page.getByRole('button', { name: 'Copy share link' }).click()
  const url = await page.locator('html').getAttribute('data-shared-url')
  expect(url).toContain('?calculator=car')
  expect(url).toContain('#v2=')

  const context = await browser.newContext()
  const sharedPage = await context.newPage()
  await sharedPage.goto(url!.replace(new URL(url!).origin, new URL(baseURL!).origin))
  await expect(sharedPage.getByLabel('Vehicle price')).toHaveValue('7654321')
  await expect(sharedPage.getByText(/Loaded from a shared link/).first()).toBeVisible()
  await context.close()
})

test('recovers from malformed state and disables data actions for invalid input', async ({ page }) => {
  await page.goto('./?calculator=generic#v2=bad')
  await expect(page.getByText(/shared scenario link was invalid/i)).toBeVisible()
  await page.getByLabel('Loan principal').fill('0')
  await expect(page.getByLabel('Loan principal')).toHaveAttribute('aria-invalid', 'true')
  for (const name of ['Copy share link', 'Print / Save PDF', 'Download CSV', 'Download Excel', 'Remember this scenario']) {
    await expect(page.getByRole('button', { name })).toBeDisabled()
  }
  await page.getByRole('button', { name: 'Reset calculator' }).click()
  await expect(page.getByLabel('Loan principal')).toHaveValue('1000000')
  await expect(page.getByRole('button', { name: 'Copy share link' })).toBeEnabled()
})

test('caps optional OD transaction rows at 100', async ({ page }) => {
  await page.goto('./?calculator=home')
  await page.getByText('Overdraft facility', { exact: true }).click()
  await page.getByLabel('Add overdraft facility').check()
  await page.getByLabel('Add dated deposits and withdrawals').check()
  const add = page.getByRole('button', { name: 'Add transaction' })
  for (let index = 0; index < 100; index += 1) await add.click()
  await expect(page.locator('.entry-editor').last().locator('.entry-row')).toHaveCount(100)
  await expect(add).toBeDisabled()
})
