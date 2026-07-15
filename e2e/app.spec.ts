import { expect, test } from '@playwright/test'

for (const [kind, rateLabel, changedRate, defaultRate] of [
  ['generic', 'Annual interest rate', '12', '10'],
  ['home', 'Annual interest rate', '11', '9'],
  ['car', 'Annual interest rate', '13', '10'],
  ['personal', 'Quoted annual rate', '15', '12'],
  ['education', 'Repayment annual rate', '14', '11'],
] as const) {
  test(`${kind} completes a calculation, graph, schedule, share, export, print, and reset journey`, async ({ page }) => {
    const errors: string[] = []
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
    page.on('pageerror', (error) => errors.push(error.message))
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: async (url: string) => { document.documentElement.dataset.sharedUrl = url } },
        configurable: true,
      })
    })
    await page.goto(`./?calculator=${kind}`)
    const headline = page.locator('.primary-result strong')
    await expect(page.getByRole('complementary', { name: 'Calculation results' }).getByRole('definition').filter({ hasText: /₹/ })).toHaveCount(4)
    await expect(page.getByText('Loan amount', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Total interest', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Other charges', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Total payable over selected tenure', { exact: true })).toBeVisible()
    await page.getByText('Detailed cost breakdown', { exact: true }).click()
    const overview = page.getByRole('region', { name: 'Detailed cost breakdown' })
    await expect(overview.getByText('Total ongoing monthly cost', { exact: true })).toBeVisible()
    await expect(overview.getByText('Monthly payment', { exact: true })).toBeVisible()
    await expect(overview.getByText('Loan composition', { exact: true })).toBeVisible()
    await expect(overview.getByText('Total loan amount', { exact: true }).last()).toBeVisible()
    await expect(overview.getByText('Total interest', { exact: true }).last()).toBeVisible()
    await expect(overview.getByText('Total other charges', { exact: true })).toBeVisible()
    await expect(overview.getByText('Total loan payable', { exact: true })).toBeVisible()
    await expect(overview.getByText(/Total overall cost for/)).toBeVisible()
    await expect(page.locator('.metric-list')).toContainText('Payoff date')
    for (const duplicate of ({
      generic: ['Total interest', 'Total repayment'],
      home: ['Loan amount', 'Total interest'],
      car: ['Financed principal', 'Total interest', 'Expected resale value'],
      personal: ['Net amount received', 'Total deductions', 'Total interest', 'Total repayment'],
      education: ['Total disbursed', 'Capitalized interest', 'Repayment principal', 'Total cost'],
    } as const)[kind]) await expect(page.locator('.metric-list')).not.toContainText(duplicate)
    const initialHeadline = await headline.textContent()
    await page.getByRole('heading', { name: 'Payment trajectory' }).scrollIntoViewIfNeeded()
    const balance = page.locator('.balance-line')
    const initialPath = await balance.getAttribute('d')
    const rate = page.getByLabel(rateLabel)
    await rate.fill(changedRate)
    await expect(headline).not.toHaveText(initialHeadline!)
    await expect(balance).not.toHaveAttribute('d', initialPath!)

    const secondYear = page.locator('.year-list details').nth(1)
    await secondYear.locator('summary').click()
    await expect(secondYear).toHaveAttribute('open', '')
    await expect(secondYear.locator('tbody tr')).not.toHaveCount(0)

    await page.getByText('Export and share', { exact: true }).click()
    await expect(page.getByRole('group', { name: 'Share and save' })).toBeVisible()
    await expect(page.getByRole('group', { name: 'Print and export' })).toBeVisible()
    await page.getByRole('button', { name: 'Copy share link' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-shared-url', /#v2=/)
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Download CSV' }).click()
    expect((await downloadPromise).suggestedFilename()).toContain(kind)
    await page.evaluate(() => { window.print = () => { document.documentElement.dataset.printed = 'true' } })
    await page.getByRole('button', { name: 'Print / Save PDF' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-printed', 'true')

    await page.getByRole('button', { name: 'Reset calculator' }).click()
    await expect(rate).toHaveValue(defaultRate)
    expect(errors).toEqual([])
  })
}

test('car separates resale proceeds from the gross tenure cost', async ({ page }) => {
  await page.goto('./?calculator=car')
  await page.getByText('Balloon and ownership horizon', { exact: true }).first().click()
  await page.getByLabel('Expected resale value').fill('300000')

  await page.getByText('Detailed cost breakdown', { exact: true }).click()
  const overview = page.getByRole('region', { name: 'Detailed cost breakdown' })
  await expect(overview.getByText('Expected proceeds', { exact: true }).first()).toBeVisible()
  await expect(overview.getByText(/₹3,00,000/).first()).toBeVisible()
  await expect(overview.getByText('Net overall cost', { exact: true })).toBeVisible()
})
