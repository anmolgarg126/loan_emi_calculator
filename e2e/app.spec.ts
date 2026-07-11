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

const modeButton = (page: Page, id: string, name: string) =>
  page.locator(`#${id}`).getByRole('button', { name, exact: true })

test('updates essential inputs and amount or percentage ownership modes', async ({ page }) => {
  const errors = monitorPage(page)
  await page.goto('./')

  await expect(page.getByRole('heading', { name: /Know the loan/i })).toBeVisible()
  await expect(page.getByText('₹35,989', { exact: false }).first()).toBeVisible()
  const defaultLoan = await page.locator('#loan-amount').inputValue()
  const defaultPayoff = await page.getByText('Standard payoff').locator('..').locator('dd').textContent()

  await page.locator('#home-value').fill('6000000')
  await page.locator('#interest-rate').fill('8.5')
  await page.locator('#tenure').fill('180')
  await page.locator('#start-date').fill('2027-01-01')
  await expect(page.locator('#loan-amount')).not.toHaveValue(defaultLoan)
  await expect(page.getByText('Standard payoff').locator('..').locator('dd')).not.toHaveText(defaultPayoff!)

  await modeButton(page, 'down-payment-mode', '₹').click()
  await page.locator('#down-payment').fill('1200000')
  await expect(page.locator('#loan-amount')).toHaveValue('4800000')
  await modeButton(page, 'down-payment-mode', '% home').click()
  await page.locator('#down-payment').fill('20')
  await expect(page.locator('#loan-amount')).toHaveValue('4800000')

  await page.getByText('Homeowner costs', { exact: true }).click()
  for (const [mode, input, percent, amount] of [
    ['processing-fee-mode', '#processing-fee', '0.5', '24000'],
    ['one-time-mode', '#one-time', '5', '300000'],
    ['property-tax-mode', '#property-tax', '1', '60000'],
    ['home-insurance-mode', '#home-insurance', '0.2', '12000'],
  ] as const) {
    await modeButton(page, mode, mode === 'processing-fee-mode' ? '% loan' : '% home').click()
    await page.locator(input).fill(percent)
    await modeButton(page, mode, '₹').click()
    await page.locator(input).fill(amount)
  }
  await page.locator('#maintenance').fill('4000')
  await expect(page.getByText('Upfront cash').locator('..').locator('dd')).toHaveText('₹15,24,000')
  await expect(page.getByLabel('Lifetime totals').getByText('₹18,00,000')).toBeVisible()
  await expectHealthyPage(page, errors)
})

test('models every prepayment frequency and both rate-reset modes', async ({ page }) => {
  const errors = monitorPage(page)
  await page.goto('./')
  const initialMonths = await page.locator('.data-tag').textContent()

  await page.getByText('Prepayments', { exact: true }).click()
  const addPrepayment = page.getByRole('button', { name: 'Add prepayment' })
  for (let index = 0; index < 4; index += 1) await addPrepayment.click()
  const prepayments = page.locator('.form-section').filter({ hasText: 'Prepayments' }).locator('.entry-row')
  await expect(prepayments).toHaveCount(4)
  for (const [index, frequency] of ['once', 'monthly', 'quarterly', 'yearly'].entries()) {
    await prepayments.nth(index).getByLabel('Amount').fill(index === 0 ? '50000' : '1000')
    await prepayments.nth(index).getByLabel('Frequency').selectOption(frequency)
  }
  await expect(page.locator('.data-tag')).not.toHaveText(initialMonths!)
  await page.getByRole('button', { name: 'Remove prepayment 2' }).click()
  await expect(prepayments).toHaveCount(3)

  await page.getByText('Interest-rate changes', { exact: true }).click()
  const addRate = page.getByRole('button', { name: 'Add rate change' })
  await addRate.click()
  await addRate.click()
  const rates = page.locator('.form-section').filter({ hasText: 'Interest-rate changes' }).locator('.entry-row')
  const rateDate = new Date(`${await page.locator('#start-date').inputValue()}T00:00:00Z`)
  rateDate.setUTCMonth(rateDate.getUTCMonth() + 24)
  await rates.nth(1).getByLabel('Effective date').fill(rateDate.toISOString().slice(0, 10))
  await rates.nth(0).getByLabel('New annual rate').fill('8')
  await rates.nth(0).getByLabel('Adjustment').selectOption('keep-emi')
  await rates.nth(1).getByLabel('New annual rate').fill('10')
  await rates.nth(1).getByLabel('Adjustment').selectOption('keep-tenure')
  await expect(rates.nth(0).getByLabel('Adjustment')).toHaveValue('keep-emi')
  await expect(rates.nth(1).getByLabel('Adjustment')).toHaveValue('keep-tenure')
  await expect(page.locator('.messages .error')).toHaveCount(0)
  await expectHealthyPage(page, errors)
})

test('models OD liquidity, dated flows, charts, lazy schedule, toggling, and reset', async ({ page }) => {
  const errors = monitorPage(page)
  await page.goto('./')
  const chartLines = page.locator('.balance-chart polyline')
  await expect(chartLines.nth(0)).toHaveAttribute('points', await chartLines.nth(1).getAttribute('points') ?? '')

  await page.getByText('Overdraft facility', { exact: true }).click()
  await page.locator('#od-enabled').check()
  await page.locator('#od-premium').fill('0.5')
  await page.locator('#od-setup-fee').fill('10000')
  await page.locator('#od-annual-fee').fill('1200')
  await expect(page.getByText('Effective initial OD rate').locator('..').locator('dd')).toHaveText('9.50%')
  await expect(page.getByText('One-time OD fee').locator('..').locator('dd')).toHaveText('₹10,000')
  await expect(page.getByText('Annual OD fees').locator('..').locator('dd')).not.toHaveText('₹0')

  const noOpeningLiquidity = await page.getByText('Ending parked liquidity').locator('..').locator('dd').textContent()
  await modeButton(page, 'opening-surplus-mode', '% loan').click()
  await page.locator('#opening-surplus').fill('10')
  await expect(page.getByText('Ending parked liquidity').locator('..').locator('dd')).not.toHaveText(noOpeningLiquidity!)
  await modeButton(page, 'opening-surplus-mode', '₹').click()
  await page.locator('#opening-surplus').fill('500000')
  const amountOpeningLiquidity = await page.getByText('Ending parked liquidity').locator('..').locator('dd').textContent()
  expect(amountOpeningLiquidity).not.toBe(noOpeningLiquidity)
  await page.locator('#monthly-surplus').fill('2000')

  await page.locator('#od-transactions').check()
  const addTransaction = page.getByRole('button', { name: 'Add OD transaction' })
  await addTransaction.click()
  await addTransaction.click()
  const transactions = page.locator('.od-fields .entry-row')
  const start = await page.locator('#start-date').inputValue()
  const firstScheduleNet = page.locator('.year-list details').first().locator('tbody tr').first().locator('td').last()
  const netBeforeFlows = await firstScheduleNet.textContent()
  await transactions.nth(0).getByLabel('Date').fill(start)
  await transactions.nth(0).getByLabel('Amount').fill('100000')
  await transactions.nth(1).getByLabel('Date').fill(start)
  await transactions.nth(1).getByLabel('Type').selectOption('withdrawal')
  await transactions.nth(1).getByLabel('Amount').fill('25000')
  await expect(firstScheduleNet).not.toHaveText(netBeforeFlows!)
  await expect(page.getByText('Ending parked liquidity').locator('..').locator('dd')).not.toHaveText(amountOpeningLiquidity!)

  const charts = page.getByRole('img')
  await expect(charts).toHaveCount(2)
  await expect(page.getByLabel('Cost composition values').locator('li')).not.toHaveCount(0)
  await expect(chartLines.nth(0)).not.toHaveAttribute('points', await chartLines.nth(1).getAttribute('points') ?? '')
  const secondYear = page.locator('.year-list details').nth(1)
  await expect(secondYear.locator('tbody tr')).toHaveCount(0)
  await secondYear.locator('summary').click()
  await expect(secondYear.locator('tbody tr')).not.toHaveCount(0)
  await expect(secondYear.locator('summary')).toContainText('Closing')

  await page.locator('#od-enabled').uncheck()
  await expect(page.getByText('OD RESULT / AFTER FEES')).toHaveCount(0)
  await expect(chartLines.nth(0)).toHaveAttribute('points', await chartLines.nth(1).getAttribute('points') ?? '')
  await page.getByRole('button', { name: 'Reset' }).click()
  await expect(page.locator('#home-value')).toHaveValue('5000000')
  await expect(page.locator('#interest-rate')).toHaveValue('9')
  await expect(page.locator('#tenure')).toHaveValue('240')
  await expect(page.locator('#od-enabled')).not.toBeChecked()
  await expect(page.getByText('₹35,989', { exact: false }).first()).toBeVisible()
  await expectHealthyPage(page, errors)
})
