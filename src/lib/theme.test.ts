import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyTheme, readTheme } from './theme'

afterEach(() => vi.unstubAllGlobals())

describe('theme preference', () => {
  it('uses light unless dark is explicitly stored', () => {
    vi.stubGlobal('localStorage', { getItem: vi.fn(() => 'unexpected') })
    expect(readTheme()).toBe('light')

    vi.stubGlobal('localStorage', { getItem: vi.fn(() => 'dark') })
    expect(readTheme()).toBe('dark')
  })

  it('falls back to light when storage is unavailable', () => {
    vi.stubGlobal('localStorage', { getItem: vi.fn(() => { throw new Error('blocked') }) })
    expect(readTheme()).toBe('light')
  })

  it('applies and stores the selected theme', () => {
    const dataset: Record<string, string> = {}
    const setItem = vi.fn()
    vi.stubGlobal('document', { documentElement: { dataset } })
    vi.stubGlobal('localStorage', { setItem })

    applyTheme('dark')

    expect(dataset.theme).toBe('dark')
    expect(setItem).toHaveBeenCalledWith('loan-emi-theme:v1', 'dark')
  })
})
