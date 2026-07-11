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
    const [header, ...rows] = csv.split('\n').map((line) => line.split(','))
    expect(csv).toContain('Payment date')
    expect(csv).toContain(String(result.standard.initialEmi))
    expect(rows).toHaveLength(result.standard.schedule.length)
    expect(csv).not.toContain('₹')
    expect(header).toEqual(expect.arrayContaining(['Month', 'Standard EMI', 'Standard principal', 'Standard interest']))
    rows.forEach((row, index) => {
      expect(row[0]).toBe(String(result.standard.schedule[index]!.month))
      expect(row[1]).toBe(result.standard.schedule[index]!.date)
      ;[0, 2, 3, 4, 5, 6, 7].forEach((column) => expect(Number.isFinite(Number(row[column]))).toBe(true))
    })
  })

  it.each([false, true])('reopens a typed %s OD XLSX workbook', async (odEnabled) => {
    const scenario = {
      ...defaultScenario(),
      tenureMonths: 24,
      od: {
        ...defaultScenario().od,
        enabled: odEnabled,
        openingSurplus: odEnabled ? 100_000 : 0,
        transactionsEnabled: odEnabled,
        transactions: [{ id: 'stored', date: defaultScenario().startDate, type: 'deposit' as const, amount: 10_000 }],
      },
    }
    const result = calculateLoan({
      ...scenario,
      od: { ...scenario.od, transactions: [{ ...scenario.od.transactions[0]!, date: scenario.startDate }] },
    })
    const workbook = await buildWorkbook(result)
    const serialized = await workbook.xlsx.writeBuffer()
    const { Workbook } = await import('exceljs')
    const reopened = new Workbook()
    await reopened.xlsx.load(serialized)

    expect(reopened.worksheets.map(({ name }) => name)).toEqual([
      'Assumptions', 'Comparison Summary', 'Monthly Amortization', 'Yearly Summary', 'OD Transactions',
    ])
    const monthly = reopened.getWorksheet('Monthly Amortization')!
    expect(monthly.getCell('B2').value).toBeInstanceOf(Date)
    expect(typeof monthly.getCell('D2').value).toBe('number')
    expect(monthly.getCell('D2').numFmt).toContain('₹')
    const savingsFormula = reopened.getWorksheet('Comparison Summary')!.getCell('C5').value
    expect(savingsFormula).toEqual(odEnabled
      ? { formula: 'B3-C3-C4', result: result.od.feeAdjustedSavings }
      : { formula: 'B3-C3-C4' })
    expect(reopened.getWorksheet('OD Transactions')!.getCell('D2').value).toBe(odEnabled)
    expect(typeof reopened.getWorksheet('OD Transactions')!.getCell('D2').value).toBe('boolean')
  })
})
