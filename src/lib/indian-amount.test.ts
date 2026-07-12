import { describe, expect, it } from 'vitest'
import { formatAmountHelper, formatIndianAmountInput, parseNumericDraft } from './indian-amount'

describe('Indian amount formatting', () => {
  it.each([
    [0, '0'],
    [1_000, '1,000'],
    [10_000, '10,000'],
    [100_000, '1,00,000'],
    [10_000_000, '1,00,00,000'],
    [12_345_678.5, '1,23,45,678.5'],
  ])('formats %s with Indian digit grouping', (value, expected) => {
    expect(formatIndianAmountInput(value)).toBe(expected)
  })

  it.each([
    ['1,23,45,678.50', 12_345_678.5],
    ['12345678.50', 12_345_678.5],
    ['', null],
    ['12.3.4', null],
    ['amount', null],
  ])('parses the numeric draft %j safely', (draft, expected) => {
    expect(parseNumericDraft(draft)).toBe(expected)
  })

  it.each([
    [0, '₹0 · Zero rupees'],
    [1_000, '₹1,000 · One thousand rupees'],
    [100_000, '₹1,00,000 · One lakh rupees'],
    [10_000_000, '₹1,00,00,000 · One crore rupees'],
    [12_345_678, '₹1,23,45,678 · One crore twenty-three lakh forty-five thousand six hundred seventy-eight rupees'],
    [100_000.49, '₹1,00,000.49 · One lakh rupees'],
    [100_000.5, '₹1,00,000.5 · One lakh one rupees'],
  ])('renders %s as compact rupee words', (value, expected) => {
    expect(formatAmountHelper(value)).toBe(expected)
  })

  it('labels percentage-derived amounts as equivalents', () => {
    expect(formatAmountHelper(1_000_000, true)).toBe('Equivalent: ₹10,00,000 · Ten lakh rupees')
  })

  it('rejects misleading helper values', () => {
    expect(formatAmountHelper(Number.NaN)).toBeNull()
    expect(formatAmountHelper(Number.POSITIVE_INFINITY)).toBeNull()
    expect(formatAmountHelper(-1)).toBeNull()
  })
})
