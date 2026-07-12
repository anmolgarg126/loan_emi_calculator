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
    const initialHeadline = await headline.textContent()
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
