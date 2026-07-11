import { expect, test } from '@playwright/test'

test('mounts monthly rows only for expanded years', async ({ page }) => {
  await page.goto('./')

  expect(await page.locator('*').count()).toBeLessThan(1_000)

  const firstYear = page.locator('.year-list details').first()
  const secondYear = page.locator('.year-list details').nth(1)
  await expect(firstYear).toHaveAttribute('open', '')
  await expect(firstYear.locator('tbody tr')).not.toHaveCount(0)
  await expect(secondYear.locator('tbody tr')).toHaveCount(0)

  await secondYear.locator('summary').click()

  await expect(secondYear.locator('tbody tr')).not.toHaveCount(0)
  await expect(firstYear).toHaveAttribute('open', '')
  await expect(firstYear.locator('tbody tr')).not.toHaveCount(0)
})

test('opens the first schedule year when its role changes', async ({ page }) => {
  await page.goto('./')

  const nextYear = await page.locator('.year-list .year-label').nth(1).textContent()
  await page.getByLabel('Loan / EMI cycle start').fill(`${nextYear}-01-01`)

  const firstYear = page.locator('.year-list details').first()
  await expect(firstYear.locator('.year-label')).toHaveText(nextYear!)
  await expect(firstYear).toHaveAttribute('open', '')
  await expect(firstYear.locator('tbody tr')).not.toHaveCount(0)
  await expect(page.locator('.year-list details').nth(1).locator('tbody tr')).toHaveCount(0)
})
