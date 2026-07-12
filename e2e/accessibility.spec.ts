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

for (const viewport of [
  { width: 320, height: 568 },
  { width: 375, height: 812 },
  { width: 430, height: 932 },
  { width: 812, height: 375 },
]) {
  test(`fits ${viewport.width}x${viewport.height} with usable targets`, async ({ page }) => {
    const errors = monitorPage(page)
    await page.setViewportSize(viewport)
    await page.goto('./')

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
    const undersized = await page.locator('button, summary, a, input, select').evaluateAll((elements) =>
      elements.filter((element) => {
        const target = element.closest('label') ?? element
        const rect = target.getBoundingClientRect()
        const style = getComputedStyle(element)
        return style.display !== 'none' && style.visibility !== 'hidden'
          && rect.width > 0 && rect.height > 0 && rect.width < 44 && rect.height < 44
      }).map((element) => {
        const htmlElement = element as HTMLElement
        const label = htmlElement.id || element.getAttribute('aria-label') || element.getAttribute('name')
          || element.textContent?.trim() || 'unlabelled'
        return `${element.tagName.toLowerCase()}[${label}]`
      }),
    )
    expect(undersized).toEqual([])
    await expectHealthyPage(page, errors)
  })
}

test('shows keyboard focus and respects reduced motion', async ({ page }) => {
  const errors = monitorPage(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('./')
  await page.keyboard.press('Tab')
  const focused = page.locator(':focus-visible')
  await expect(focused).toBeVisible()
  expect(await focused.evaluate((element) => {
    const style = getComputedStyle(element)
    const shell = element.closest('.input-shell')
    return (style.outlineStyle === 'solid' && Number.parseFloat(style.outlineWidth) >= 3)
      || Boolean(shell && getComputedStyle(shell).boxShadow !== 'none')
  })).toBe(true)
  expect(await page.locator('.summary-mark').first().evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).transitionDuration),
  )).toBeLessThan(0.001)
  await expectHealthyPage(page, errors)
})

test('keeps the initial DOM bounded while exposing schedule data', async ({ page }) => {
  const errors = monitorPage(page)
  await page.goto('./')
  expect(await page.locator('*').count()).toBeLessThan(1_000)
  const rows = page.locator('.suite-schedule tbody tr')
  await expect(rows).not.toHaveCount(0)
  expect(await rows.count()).toBeLessThanOrEqual(24)
  await expectHealthyPage(page, errors)
})

test('supports arrow-key navigation between calculator tabs', async ({ page }) => {
  const errors = monitorPage(page)
  await page.goto('./')
  const generic = page.getByRole('tab', { name: 'Generic' })
  const home = page.getByRole('tab', { name: 'Home' })
  await generic.focus()
  await page.keyboard.press('ArrowRight')
  await expect(home).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(home).toHaveAttribute('aria-selected', 'true')
  await expectHealthyPage(page, errors)
})
