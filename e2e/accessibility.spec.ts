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
