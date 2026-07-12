import type { CalculationResult } from '../domain/loan'
import type { SuiteResult } from '../domain/calculators'

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

const csvCell = (value: string | number | boolean) => {
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export const createCsv = (result: CalculationResult) => {
  const headers = [
    'Month',
    'Payment date',
    'Standard rate',
    'Standard EMI',
    'Standard principal',
    'Standard interest',
    'Prepayment',
    'Standard balance',
    'OD rate',
    'OD payment',
    'OD interest',
    'OD drawing power',
    'OD parked surplus',
    'OD net utilized',
  ]
  const rows = result.standard.schedule.map((row, index) => {
    const od = result.od.schedule[index]
    return [
      row.month,
      row.date,
      row.annualRate / 100,
      row.emi,
      row.principal,
      row.interest,
      row.prepayment,
      row.balance,
      od ? od.annualRate / 100 : '',
      od?.payment ?? '',
      od?.interest ?? '',
      od?.drawingPower ?? '',
      od?.parkedSurplus ?? '',
      od?.netUtilized ?? '',
    ]
  })
  return [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\n')
}

export const downloadCsv = (result: CalculationResult) => {
  downloadBlob(new Blob([createCsv(result)], { type: 'text/csv;charset=utf-8' }), 'loan-ledger-schedule.csv')
}

const asDate = (value: string) => new Date(`${value}T00:00:00.000Z`)

export const buildWorkbook = async (result: CalculationResult) => {
  const { Workbook } = await import('exceljs')
  const workbook = new Workbook()
  workbook.creator = 'Loan Ledger'
  workbook.created = new Date()
  workbook.calcProperties.fullCalcOnLoad = true

  const assumptions = workbook.addWorksheet('Assumptions', { views: [{ state: 'frozen', ySplit: 1 }] })
  assumptions.columns = [
    { header: 'Assumption', key: 'label', width: 34 },
    { header: 'Value', key: 'value', width: 24 },
    { header: 'Unit / basis', key: 'unit', width: 34 },
  ]
  assumptions.addRows([
    { label: 'Home value', value: result.scenario.homeValue, unit: 'INR' },
    { label: 'Loan amount', value: result.loanAmount, unit: 'INR' },
    { label: 'Annual interest rate', value: result.scenario.annualRate / 100, unit: 'percentage' },
    { label: 'Tenure', value: result.scenario.tenureMonths, unit: 'months' },
    { label: 'Loan start', value: asDate(result.scenario.startDate), unit: 'date' },
    { label: 'OD enabled', value: result.scenario.od.enabled, unit: 'boolean' },
    { label: 'OD premium', value: result.scenario.od.premiumRate / 100, unit: 'percentage points' },
    { label: 'Day-count convention', value: 'Actual/365', unit: 'lender-neutral assumption' },
    { label: 'Disclaimer', value: 'Educational estimate; verify against lender terms.', unit: 'text' },
  ])

  const summary = workbook.addWorksheet('Comparison Summary', { views: [{ state: 'frozen', ySplit: 1 }] })
  summary.columns = [
    { header: 'Metric', key: 'metric', width: 34 },
    { header: 'Standard loan', key: 'standard', width: 22 },
    { header: 'OD loan', key: 'od', width: 22 },
  ]
  summary.addRows([
    { metric: 'Initial EMI', standard: result.standard.initialEmi, od: result.od.schedule[0]?.payment ?? result.standard.initialEmi },
    { metric: 'Total interest', standard: result.standard.totalInterest, od: result.od.totalInterest },
    { metric: 'OD fees', standard: 0, od: result.od.totalFees },
    { metric: 'Fee-adjusted OD savings', standard: 0, od: result.od.feeAdjustedSavings },
    { metric: 'Total modelled outflow', standard: result.standard.totalModelledOutflow, od: result.od.totalModelledOutflow },
  ])
  summary.getCell('C5').value = {
    formula: 'B3-C3-C4',
    result: result.od.feeAdjustedSavings,
  }

  const monthly = workbook.addWorksheet('Monthly Amortization', { views: [{ state: 'frozen', ySplit: 1 }] })
  monthly.columns = [
    { header: 'Month', key: 'month', width: 10 },
    { header: 'Payment date', key: 'date', width: 15 },
    { header: 'Standard rate', key: 'standardRate', width: 15 },
    { header: 'Standard EMI', key: 'standardEmi', width: 18 },
    { header: 'Principal', key: 'principal', width: 18 },
    { header: 'Standard interest', key: 'standardInterest', width: 18 },
    { header: 'Prepayment', key: 'prepayment', width: 18 },
    { header: 'Standard balance', key: 'standardBalance', width: 20 },
    { header: 'OD rate', key: 'odRate', width: 15 },
    { header: 'OD payment', key: 'odPayment', width: 18 },
    { header: 'OD interest', key: 'odInterest', width: 18 },
    { header: 'Drawing power', key: 'drawingPower', width: 18 },
    { header: 'Parked surplus', key: 'parkedSurplus', width: 18 },
    { header: 'Available withdrawal', key: 'availableWithdrawal', width: 20 },
    { header: 'Net utilized', key: 'netUtilized', width: 18 },
  ]
  result.standard.schedule.forEach((row, index) => {
    const od = result.od.schedule[index]
    monthly.addRow({
      month: row.month,
      date: asDate(row.date),
      standardRate: row.annualRate / 100,
      standardEmi: row.emi,
      principal: row.principal,
      standardInterest: row.interest,
      prepayment: row.prepayment,
      standardBalance: row.balance,
      odRate: od ? od.annualRate / 100 : null,
      odPayment: od?.payment ?? null,
      odInterest: od?.interest ?? null,
      drawingPower: od?.drawingPower ?? null,
      parkedSurplus: od?.parkedSurplus ?? null,
      availableWithdrawal: od?.availableWithdrawal ?? null,
      netUtilized: od?.netUtilized ?? null,
    })
  })

  const yearly = workbook.addWorksheet('Yearly Summary', { views: [{ state: 'frozen', ySplit: 1 }] })
  yearly.columns = [
    { header: 'Year', key: 'year', width: 10 },
    { header: 'Principal', key: 'principal', width: 18 },
    { header: 'Standard interest', key: 'standardInterest', width: 20 },
    { header: 'OD interest', key: 'odInterest', width: 18 },
    { header: 'Prepayments', key: 'prepayment', width: 18 },
    { header: 'Ending balance', key: 'balance', width: 20 },
  ]
  const byYear = new Map<number, { principal: number; standardInterest: number; odInterest: number; prepayment: number; balance: number }>()
  result.standard.schedule.forEach((row, index) => {
    const year = Number(row.date.slice(0, 4))
    const current = byYear.get(year) ?? { principal: 0, standardInterest: 0, odInterest: 0, prepayment: 0, balance: 0 }
    current.principal += row.principal
    current.standardInterest += row.interest
    current.odInterest += result.od.schedule[index]?.interest ?? 0
    current.prepayment += row.prepayment
    current.balance = row.balance
    byYear.set(year, current)
  })
  byYear.forEach((values, year) => yearly.addRow({ year, ...values }))

  const transactions = workbook.addWorksheet('OD Transactions', { views: [{ state: 'frozen', ySplit: 1 }] })
  transactions.columns = [
    { header: 'Date', key: 'date', width: 15 },
    { header: 'Type', key: 'type', width: 14 },
    { header: 'Amount', key: 'amount', width: 18 },
    { header: 'Enabled', key: 'enabled', width: 12 },
  ]
  result.scenario.od.transactions.forEach((transaction) =>
    transactions.addRow({
      date: asDate(transaction.date),
      type: transaction.type,
      amount: transaction.amount,
      enabled: result.scenario.od.enabled && result.scenario.od.transactionsEnabled,
    }),
  )

  for (const worksheet of workbook.worksheets) {
    if (worksheet.rowCount > 1) worksheet.autoFilter = `A1:${worksheet.getCell(1, worksheet.columnCount).address}`
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF143F34' } }
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) row.alignment = { vertical: 'middle' }
    })
  }

  const moneyFormat = '₹#,##0.00;[Red]-₹#,##0.00'
  const percentFormat = '0.00%'
  assumptions.getCell('B2').numFmt = moneyFormat
  assumptions.getCell('B3').numFmt = moneyFormat
  assumptions.getCell('B4').numFmt = percentFormat
  assumptions.getCell('B5').numFmt = '0'
  assumptions.getCell('B6').numFmt = 'dd-mmm-yyyy'
  assumptions.getCell('B8').numFmt = percentFormat
  summary.getColumn(2).numFmt = moneyFormat
  summary.getColumn(3).numFmt = moneyFormat
  monthly.getColumn('date').numFmt = 'dd-mmm-yyyy'
  ;['standardRate', 'odRate'].forEach((key) => (monthly.getColumn(key).numFmt = percentFormat))
  ;['standardEmi', 'principal', 'standardInterest', 'prepayment', 'standardBalance', 'odPayment', 'odInterest', 'drawingPower', 'parkedSurplus', 'availableWithdrawal', 'netUtilized'].forEach(
    (key) => (monthly.getColumn(key).numFmt = moneyFormat),
  )
  ;['principal', 'standardInterest', 'odInterest', 'prepayment', 'balance'].forEach(
    (key) => (yearly.getColumn(key).numFmt = moneyFormat),
  )
  transactions.getColumn('date').numFmt = 'dd-mmm-yyyy'
  transactions.getColumn('amount').numFmt = moneyFormat
  return workbook
}

export const downloadXlsx = async (result: CalculationResult) => {
  const workbook = await buildWorkbook(result)
  const buffer = await workbook.xlsx.writeBuffer()
  downloadBlob(
    new Blob([buffer as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    'loan-ledger.xlsx',
  )
}

export const createSuiteCsv = (result: SuiteResult) => {
  const headers = ['Period', 'Payment date', 'Payment', 'Principal', 'Interest', 'Prepayment', 'Costs', 'Balance', 'OD net utilized']
  const rows = result.view.schedule.map((row) => [
    row.period,
    row.date,
    row.payment,
    row.principal,
    row.interest,
    row.prepayment,
    row.costs,
    row.balance,
    row.odNetUtilized ?? '',
  ])
  return [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\n')
}

const suiteAssumptions = (result: SuiteResult) => {
  switch (result.kind) {
    case 'generic': return [
      ['Principal', result.scenario.principal, 'INR'],
      ['Annual interest rate', result.scenario.annualRate / 100, 'percentage'],
      ['Tenure', result.scenario.tenureMonths, 'months'],
      ['First EMI date', asDate(result.scenario.startDate), 'date'],
      ['Processing fee', result.scenario.processingFee, 'INR'],
    ]
    case 'home': return [
      ['Home value', result.scenario.homeValue, 'INR'],
      ['Loan amount', result.native.loanAmount, 'INR'],
      ['Annual interest rate', result.scenario.annualRate / 100, 'percentage'],
      ['Tenure', result.scenario.tenureMonths, 'months'],
      ['Loan start', asDate(result.scenario.startDate), 'date'],
      ['OD enabled', result.scenario.od.enabled, 'boolean'],
    ]
    case 'car': return [
      ['Vehicle price', result.scenario.vehiclePrice, 'INR'],
      ['Financed principal', result.native.financedPrincipal, 'INR'],
      ['Annual interest rate', result.scenario.annualRate / 100, 'percentage'],
      ['Tenure', result.scenario.tenureMonths, 'months'],
      ['First EMI date', asDate(result.scenario.startDate), 'date'],
      ['Registration financed', result.scenario.financeRegistrationFees, 'boolean'],
    ]
    case 'personal': return [
      ['Requested principal', result.scenario.principal, 'INR'],
      ['Net disbursed', result.native.netDisbursed, 'INR'],
      ['Quoted annual rate', result.scenario.quotedAnnualRate / 100, 'percentage'],
      ['Effective APR', result.native.effectiveApr / 100, 'percentage'],
      ['Tenure', result.scenario.tenureMonths, 'months'],
      ['First EMI date', asDate(result.scenario.startDate), 'date'],
    ]
    case 'education': return [
      ['Course cost', result.scenario.courseCost, 'INR'],
      ['Total disbursed', result.native.totalDisbursed, 'INR'],
      ['Study annual rate', result.scenario.studyAnnualRate / 100, 'percentage'],
      ['Repayment annual rate', result.scenario.repaymentAnnualRate / 100, 'percentage'],
      ['Study start', asDate(result.scenario.startDate), 'date'],
      ['Repayment start', asDate(result.native.repaymentStartDate), 'date'],
    ]
  }
}

export const buildSuiteWorkbook = async (result: SuiteResult) => {
  const { Workbook } = await import('exceljs')
  const workbook = new Workbook()
  workbook.creator = 'Loan EMI Calculator'
  workbook.created = new Date()
  workbook.calcProperties.fullCalcOnLoad = true
  const moneyFormat = '₹#,##0.00;[Red]-₹#,##0.00'
  const percentFormat = '0.00%'

  const assumptions = workbook.addWorksheet('Assumptions', { views: [{ state: 'frozen', ySplit: 1 }] })
  assumptions.columns = [
    { header: 'Assumption', key: 'label', width: 32 },
    { header: 'Value', key: 'value', width: 22 },
    { header: 'Unit / basis', key: 'unit', width: 24 },
  ]
  suiteAssumptions(result).forEach(([label, value, unit]) => assumptions.addRow({ label, value, unit }))
  assumptions.eachRow((row, index) => {
    if (index === 1) return
    const unit = row.getCell(3).value
    if (unit === 'INR') row.getCell(2).numFmt = moneyFormat
    if (unit === 'percentage') row.getCell(2).numFmt = percentFormat
    if (unit === 'months') row.getCell(2).numFmt = '0'
    if (unit === 'date') row.getCell(2).numFmt = 'dd-mmm-yyyy'
  })

  const monthly = workbook.addWorksheet('Monthly Schedule', { views: [{ state: 'frozen', ySplit: 1 }] })
  monthly.columns = [
    { header: 'Period', key: 'period', width: 10 },
    { header: 'Payment date', key: 'date', width: 16 },
    { header: 'Payment', key: 'payment', width: 18 },
    { header: 'Principal', key: 'principal', width: 18 },
    { header: 'Interest', key: 'interest', width: 18 },
    { header: 'Prepayment', key: 'prepayment', width: 18 },
    { header: 'Costs', key: 'costs', width: 18 },
    { header: 'Balance', key: 'balance', width: 18 },
    { header: 'OD net utilized', key: 'odNetUtilized', width: 20 },
  ]
  result.view.schedule.forEach((row) => monthly.addRow({ ...row, date: asDate(row.date), odNetUtilized: row.odNetUtilized ?? null }))
  monthly.getColumn('period').numFmt = '0'
  monthly.getColumn('date').numFmt = 'dd-mmm-yyyy'
  ;['payment', 'principal', 'interest', 'prepayment', 'costs', 'balance', 'odNetUtilized'].forEach((key) => (monthly.getColumn(key).numFmt = moneyFormat))

  if (result.kind === 'home') {
    const summary = workbook.addWorksheet('Comparison Summary')
    summary.addRows([
      ['Metric', 'Standard loan', 'OD loan'],
      ['Total interest', result.native.standard.totalInterest, result.native.od.totalInterest],
      ['Fees', 0, result.native.od.totalFees],
      ['Fee-adjusted savings', 0, result.native.od.feeAdjustedSavings],
    ])
    summary.getCell('C4').value = { formula: 'B2-C2-C3', result: result.native.od.feeAdjustedSavings }
    summary.getColumn(2).numFmt = moneyFormat
    summary.getColumn(3).numFmt = moneyFormat
    const transactions = workbook.addWorksheet('OD Transactions')
    transactions.addRow(['Date', 'Type', 'Amount', 'Enabled'])
    result.scenario.od.transactions.forEach((item) => transactions.addRow([asDate(item.date), item.type, item.amount, result.scenario.od.enabled && result.scenario.od.transactionsEnabled]))
    transactions.getColumn(1).numFmt = 'dd-mmm-yyyy'
    transactions.getColumn(3).numFmt = moneyFormat
  }
  if (result.kind === 'car') {
    const sheet = workbook.addWorksheet('Balloon and Ownership Summary')
    sheet.addRows([
      ['Metric', 'Value'],
      ['Balloon amount', result.native.balloonAmount],
      ['Ownership horizon', result.scenario.ownershipMonths],
      ['Remaining settlement', result.native.remainingLoanSettlement],
      ['Expected resale value', result.scenario.expectedResaleValue],
      ['Net ownership cost', result.native.netOwnershipCost],
    ])
    sheet.getColumn(2).numFmt = moneyFormat
    sheet.getCell('B3').numFmt = '0'
  }
  if (result.kind === 'personal') {
    const sheet = workbook.addWorksheet('Deductions and APR Summary')
    sheet.addRows([
      ['Metric', 'Value'],
      ['Processing fee', result.native.processingFeeAmount],
      ['GST', result.native.gstAmount],
      ['Insurance deduction', result.native.insuranceDeduction],
      ['Other deduction', result.native.otherDeduction],
      ['Net disbursed', result.native.netDisbursed],
      ['Effective APR', result.native.effectiveApr / 100],
    ])
    sheet.getColumn(2).numFmt = moneyFormat
    sheet.getCell('B7').numFmt = percentFormat
  }
  if (result.kind === 'education') {
    const disbursements = workbook.addWorksheet('Disbursements')
    disbursements.addRow(['ID', 'Date', 'Amount'])
    result.scenario.disbursements.forEach((item) => disbursements.addRow([item.id, asDate(item.date), item.amount]))
    disbursements.getColumn(2).numFmt = 'dd-mmm-yyyy'
    disbursements.getColumn(3).numFmt = moneyFormat
    const phases = workbook.addWorksheet('Phase Summary')
    phases.addRow(['Date', 'Phase', 'Disbursement', 'Interest serviced', 'Outstanding principal', 'Accrued interest'])
    result.native.phaseRows.forEach((row) => phases.addRow([asDate(row.date), row.phase, row.disbursement, row.payment, row.outstandingPrincipal, row.accruedInterest]))
    phases.getColumn(1).numFmt = 'dd-mmm-yyyy'
    ;[3, 4, 5, 6].forEach((column) => (phases.getColumn(column).numFmt = moneyFormat))
  }

  workbook.worksheets.forEach((worksheet) => {
    if (worksheet.rowCount > 1) worksheet.autoFilter = `A1:${worksheet.getCell(1, worksheet.columnCount).address}`
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D675F' } }
  })
  return workbook
}

export const downloadSuiteCsv = (result: SuiteResult) => {
  downloadBlob(new Blob([createSuiteCsv(result)], { type: 'text/csv;charset=utf-8' }), `${result.kind}-loan-schedule.csv`)
}

export const downloadSuiteXlsx = async (result: SuiteResult) => {
  const workbook = await buildSuiteWorkbook(result)
  const buffer = await workbook.xlsx.writeBuffer()
  downloadBlob(new Blob([buffer as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${result.kind}-loan-analysis.xlsx`)
}
