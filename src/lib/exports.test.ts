import { describe, expect, it } from 'vitest'
import { calculateLoan, defaultScenario, formatCurrency } from '../domain/loan'
import { buildWorkbook, createCsv } from './exports'

describe('exports', () => {
  it('formats currency consistently and treats non-finite values as zero', () => {
    const formatted = formatCurrency(1_234.56, 2)
    expect(formatCurrency(1_234.56, 2)).toBe(formatted)
    expect(formatCurrency(Number.NaN, 2)).toBe(formatCurrency(0, 2))
    expect(formatCurrency(Number.POSITIVE_INFINITY)).toBe(formatCurrency(0))
  })

  it('keeps CSV values machine-readable', () => {
    const result = calculateLoan(defaultScenario())
    const csv = createCsv(result)
    expect(csv).toContain('Payment date')
    expect(csv).toContain(String(result.standard.initialEmi))
    expect(csv.split('\n')).toHaveLength(result.standard.schedule.length + 1)
    expect(csv).not.toContain('₹')
  })

  it('writes typed XLSX cells', async () => {
    const scenario = defaultScenario()
    const result = calculateLoan({
      ...scenario,
      tenureMonths: 24,
      od: {
        ...scenario.od,
        enabled: true,
        openingSurplus: 100_000,
        transactionsEnabled: false,
        transactions: [{ id: 'stored', date: scenario.startDate, type: 'deposit', amount: 10_000 }],
      },
    })
    const workbook = await buildWorkbook(result)
    const monthly = workbook.getWorksheet('Monthly Amortization')!
    expect(monthly.getCell('A2').value).toBe(1)
    expect(monthly.getCell('B2').value).toBeInstanceOf(Date)
    expect(typeof monthly.getCell('D2').value).toBe('number')
    expect(monthly.getCell('D2').numFmt).toContain('₹')
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      'Assumptions',
      'Comparison Summary',
      'Monthly Amortization',
      'Yearly Summary',
      'OD Transactions',
    ])
    expect(workbook.getWorksheet('Comparison Summary')?.getCell('C5').value).toEqual({
      formula: 'B3-C3-C4',
      result: result.od.feeAdjustedSavings,
    })

    const serialized = await workbook.xlsx.writeBuffer()
    const { Workbook } = await import('exceljs')
    const reopened = new Workbook()
    await reopened.xlsx.load(serialized)
    expect(reopened.getWorksheet('Monthly Amortization')?.getCell('B2').value).toBeInstanceOf(Date)
    expect(typeof reopened.getWorksheet('Monthly Amortization')?.getCell('D2').value).toBe('number')
    expect(reopened.getWorksheet('OD Transactions')?.getCell('D1').value).toBe('Enabled')
    expect(reopened.getWorksheet('OD Transactions')?.getCell('D2').value).toBe(false)
    expect(typeof reopened.getWorksheet('OD Transactions')?.getCell('D2').value).toBe('boolean')
    expect(reopened.getWorksheet('Comparison Summary')?.getCell('C5').value).toEqual({
      formula: 'B3-C3-C4',
      result: result.od.feeAdjustedSavings,
    })
  })
})
