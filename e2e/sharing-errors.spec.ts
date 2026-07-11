import { expect, test, type Page } from '@playwright/test'

const captureBrowserErrors = (page: Page) => {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))
  return errors
}

test('marks a valid shared scenario and clears provenance on reset', async ({ page }) => {
  const browserErrors = captureBrowserErrors(page)
  await page.goto('./#v1=eyJhbm51YWxSYXRlIjo4LjI1fQ')

  await expect(page.getByText(/Loaded from a shared link/)).toBeVisible()
  await page.getByRole('button', { name: 'Reset' }).click()
  await expect(page.getByText(/Loaded from a shared link/)).toHaveCount(0)
  expect(browserErrors).toEqual([])
})

test('recovers from malformed shared state and disables stale actions for invalid input', async ({ page }) => {
  const browserErrors = captureBrowserErrors(page)
  await page.goto('./#v1=eyJyYXRlQ2hhbmdlcyI6W251bGxdfQ')

  await expect(page.getByText(/shared scenario link was invalid/i)).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Build your scenario' })).toBeVisible()
  await page.locator('#home-value').fill('0')
  await expect(page.locator('#home-value')).toHaveAttribute('aria-invalid', 'true')
  await expect(page.locator('#home-value-error')).toContainText('Home value must be above')
  for (const name of ['Copy share link', 'Print / Save PDF', 'Download CSV', 'Download Excel']) {
    await expect(page.getByRole('button', { name })).toBeDisabled()
  }
  expect(browserErrors).toEqual([])
})
