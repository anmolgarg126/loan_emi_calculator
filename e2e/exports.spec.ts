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

test('downloads calculator-specific CSV and XLSX and prepares print', async ({ page }) => {
  const errors = monitorPage(page)
  for (const kind of ['generic', 'home'] as const) {
    await page.goto(`./?calculator=${kind}`)
    for (const [name, extension] of [['Download CSV', '.csv'], ['Download Excel', '.xlsx']] as const) {
      const downloadPromise = page.waitForEvent('download')
      await page.getByRole('button', { name }).click()
      const download = await downloadPromise
      expect(download.suggestedFilename()).toContain(kind)
      expect(download.suggestedFilename()).toContain(extension)
      const stream = await download.createReadStream()
      let bytes = 0
      for await (const chunk of stream!) bytes += chunk.length
      expect(bytes).toBeGreaterThan(100)
    }
  }
  await page.evaluate(() => { window.print = () => { document.documentElement.dataset.printed = 'true' } })
  await page.getByRole('button', { name: 'Print / Save PDF' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-printed', 'true')
  await expectHealthyPage(page, errors)
})
