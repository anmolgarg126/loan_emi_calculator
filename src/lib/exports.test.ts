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
      const standard = result.standard.schedule[index]!
      const od = result.od.schedule[index]!
      expect(row).toEqual([
        String(standard.month),
        standard.date,
        String(standard.annualRate / 100),
        String(standard.emi),
        String(standard.principal),
        String(standard.interest),
        String(standard.prepayment),
        String(standard.balance),
        String(od.annualRate / 100),
        String(od.payment),
        String(od.interest),
        String(od.drawingPower),
        String(od.parkedSurplus),
        String(od.netUtilized),
      ])
      row.filter((_value, column) => column !== 1)
        .forEach((value) => expect(Number.isFinite(Number(value))).toBe(true))
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
    const firstStandard = result.standard.schedule[0]!
    const firstOd = result.od.schedule[0]!
    expect(monthly.getCell('A2').value).toBe(firstStandard.month)
    expect(monthly.getCell('B2').value).toBeInstanceOf(Date)
    expect((monthly.getCell('B2').value as Date).toISOString().slice(0, 10)).toBe(firstStandard.date)
    expect(monthly.getCell('C2').value).toBe(firstStandard.annualRate / 100)
    expect(monthly.getCell('D2').value).toBe(firstStandard.emi)
    expect(monthly.getCell('F2').value).toBe(firstStandard.interest)
    expect(monthly.getCell('K2').value).toBe(firstOd.interest)
    expect(monthly.getCell('L2').value).toBe(firstOd.drawingPower)
    expect(typeof monthly.getCell('A2').value).toBe('number')
    expect(typeof monthly.getCell('D2').value).toBe('number')
    expect(monthly.getCell('C2').numFmt).toContain('%')
    expect(monthly.getCell('D2').numFmt).toContain('₹')

    const assumptions = reopened.getWorksheet('Assumptions')!
    const expectedAssumptions = [
      ['B2', result.scenario.homeValue, 'number', '₹#,##0.00;[Red]-₹#,##0.00'],
      ['B3', result.loanAmount, 'number', '₹#,##0.00;[Red]-₹#,##0.00'],
      ['B4', result.scenario.annualRate / 100, 'number', '0.00%'],
      ['B5', result.scenario.tenureMonths, 'number', '0'],
      ['B6', result.scenario.startDate, 'date', 'dd-mmm-yyyy'],
      ['B7', odEnabled, 'boolean', undefined],
      ['B8', result.scenario.od.premiumRate / 100, 'number', '0.00%'],
      ['B9', 'Actual/365', 'string', undefined],
      ['B10', 'Educational estimate; verify against lender terms.', 'string', undefined],
    ] as const
    expectedAssumptions.forEach(([address, expectedValue, expectedType, expectedNumFmt]) => {
      const cell = assumptions.getCell(address)
      if (expectedType === 'date') {
        expect(cell.value).toBeInstanceOf(Date)
        expect((cell.value as Date).toISOString().slice(0, 10)).toBe(expectedValue)
      } else {
        expect(cell.value).toBe(expectedValue)
        expect(typeof cell.value).toBe(expectedType)
      }
      expect(cell.numFmt).toBe(expectedNumFmt)
    })

    const summary = reopened.getWorksheet('Comparison Summary')!
    expect(summary.getCell('B3').value).toBe(result.standard.totalInterest)
    expect(summary.getCell('C3').value).toBe(result.od.totalInterest)
    expect(summary.getCell('C4').value).toBe(result.od.totalFees)
    const savingsFormula = reopened.getWorksheet('Comparison Summary')!.getCell('C5').value
    expect(savingsFormula).toEqual(odEnabled
      ? { formula: 'B3-C3-C4', result: result.od.feeAdjustedSavings }
      : { formula: 'B3-C3-C4' })
    const transactions = reopened.getWorksheet('OD Transactions')!
    expect(transactions.getCell('A2').value).toBeInstanceOf(Date)
    expect(transactions.getCell('B2').value).toBe('deposit')
    expect(transactions.getCell('C2').value).toBe(10_000)
    expect(transactions.getCell('C2').numFmt).toContain('₹')
    expect(transactions.getCell('D2').value).toBe(odEnabled)
    expect(typeof transactions.getCell('D2').value).toBe('boolean')

    const yearly = reopened.getWorksheet('Yearly Summary')!
    const yearlyPrincipal = Array.from({ length: yearly.rowCount - 1 }, (_, index) => Number(yearly.getCell(index + 2, 2).value))
      .reduce((sum, value) => sum + value, 0)
    const yearlyStandardInterest = Array.from({ length: yearly.rowCount - 1 }, (_, index) => Number(yearly.getCell(index + 2, 3).value))
      .reduce((sum, value) => sum + value, 0)
    const yearlyOdInterest = Array.from({ length: yearly.rowCount - 1 }, (_, index) => Number(yearly.getCell(index + 2, 4).value))
      .reduce((sum, value) => sum + value, 0)
    expect(yearlyPrincipal).toBeCloseTo(result.standard.schedule.reduce((sum, row) => sum + row.principal, 0), 2)
    expect(yearlyStandardInterest).toBeCloseTo(result.standard.totalInterest, 2)
    expect(yearlyOdInterest).toBeCloseTo(result.od.totalInterest, 2)
  })
})
