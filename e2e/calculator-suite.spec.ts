import { expect, test } from '@playwright/test'

test('shows calculator tabs, solver tools, and private-device status', async ({ page }) => {
  await page.goto('./?calculator=home')
  await expect(page.getByRole('tab', { name: 'Home' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('button', { name: 'Affordability' })).toBeVisible()
  await expect(page.getByText('Calculated privately on this device')).toBeVisible()
})

for (const [tab, field] of [
  ['Generic', 'Loan principal'],
  ['Home', 'Home value'],
  ['Car', 'Vehicle price'],
  ['Personal', 'Requested loan amount'],
  ['Education', 'Course cost'],
] as const) {
  test(`${tab} exposes its specialized inputs`, async ({ page }) => {
    await page.goto('./')
    await page.getByRole('tab', { name: tab }).click()
    await expect(page.getByLabel(field)).toBeVisible()
    await expect(page).toHaveURL(new RegExp(`calculator=${tab.toLowerCase()}`))
  })
}

test('resets and restores the calculator through undo', async ({ page }) => {
  await page.goto('./?calculator=car')
  const price = page.getByLabel('Vehicle price')
  await price.fill('2000000')
  await page.getByRole('button', { name: 'Reset calculator' }).click()
  await expect(price).toHaveValue('1000000')
  await page.getByRole('button', { name: 'Undo reset' }).click()
  await expect(price).toHaveValue('2000000')
})

for (const tool of ['Affordability', 'Prepayment', 'Tenure', 'Interest rate'] as const) {
  test(`${tool} solver opens with a live result`, async ({ page }) => {
    await page.goto('./')
    await page.getByRole('button', { name: tool, exact: true }).click()
    await expect(page.getByRole('heading', { name: new RegExp(`${tool} solver`, 'i') })).toBeVisible()
    await expect(page.locator('.solver-answer')).toBeVisible()
    await page.getByRole('button', { name: 'Close solver' }).click()
    await expect(page.locator('.solver-panel')).toHaveCount(0)
  })
}

test('solver reports impossible combinations inline', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: 'Tenure' }).click()
  await page.getByLabel('Monthly EMI').fill('100')
  await expect(page.locator('.solver-answer')).toContainText('EMI must exceed first-month interest')
})
