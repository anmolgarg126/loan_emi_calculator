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
  await expect(price).toHaveValue('10,00,000')
  await page.getByRole('button', { name: 'Undo reset' }).click()
  await expect(price).toHaveValue('20,00,000')
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

test('replaces zero amounts and formats them after editing', async ({ page }) => {
  await page.goto('./?calculator=generic')
  await page.getByText('Fees', { exact: true }).click()
  const fee = page.getByLabel('Processing fee', { exact: true })
  await fee.click()
  await page.keyboard.type('343')
  await fee.blur()
  await expect(fee).toHaveValue('343')
  await expect(page.locator('#generic-fee-amount')).toHaveText('₹343 · Three hundred forty-three rupees')

  await page.getByRole('button', { name: 'Affordability' }).click()
  const emi = page.getByLabel('Monthly EMI')
  await emi.click()
  await page.keyboard.type('100000')
  await emi.blur()
  await expect(emi).toHaveValue('1,00,000')
  await expect(page.locator('#solver-emi-amount')).toHaveText('₹1,00,000 · One lakh rupees')
})

test('shows rupee words for percentage-based amount fields', async ({ page }) => {
  await page.goto('./?calculator=home')
  await expect(page.locator('#down-payment-amount')).toHaveText('Equivalent: ₹10,00,000 · Ten lakh rupees')
  await expect(page.getByLabel('Calculated loan amount')).toHaveValue('40,00,000')
  await expect(page.locator('#loan-amount-words')).toHaveText('₹40,00,000 · Forty lakh rupees')
  await expect(page.locator('#interest-rate-amount')).toHaveCount(0)

  await page.getByRole('tab', { name: 'Car' }).click()
  await expect(page.locator('#car-down-payment-amount')).toHaveText('Equivalent: ₹2,00,000 · Two lakh rupees')

  await page.getByRole('tab', { name: 'Personal' }).click()
  await page.getByText('Upfront deductions', { exact: true }).click()
  await page.getByRole('button', { name: '% of principal' }).click()
  const fee = page.getByLabel('Processing fee', { exact: true })
  await fee.fill('2')
  await fee.blur()
  await expect(page.locator('#personal-fee-amount')).toHaveText('Equivalent: ₹10,000 · Ten thousand rupees')
})
