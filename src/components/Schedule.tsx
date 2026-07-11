import { useMemo, useState } from 'react'
import { formatCurrency, type CalculationResult, type ScheduleRow } from '../domain/loan'

interface YearGroup {
  year: string
  rows: Array<{ standard: ScheduleRow; od: CalculationResult['od']['schedule'][number] | undefined }>
}

function YearSchedule({ group, initiallyOpen }: { group: YearGroup; initiallyOpen: boolean }) {
  const [open, setOpen] = useState(initiallyOpen)
  const principal = group.rows.reduce((sum, row) => sum + row.standard.principal + row.standard.prepayment, 0)
  const interest = group.rows.reduce((sum, row) => sum + row.standard.interest, 0)
  const odInterest = group.rows.reduce((sum, row) => sum + (row.od?.interest ?? row.standard.interest), 0)
  const balance = group.rows.at(-1)?.standard.balance ?? 0

  return (
    <details open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>
        <span className="year-label">{group.year}</span>
        <span>
          <small>Principal</small>
          <strong>{formatCurrency(principal)}</strong>
        </span>
        <span>
          <small>Interest</small>
          <strong>{formatCurrency(interest)}</strong>
        </span>
        <span className="od-year-cell">
          <small>OD interest</small>
          <strong>{formatCurrency(odInterest)}</strong>
        </span>
        <span>
          <small>Closing</small>
          <strong>{formatCurrency(balance)}</strong>
        </span>
      </summary>
      {open && (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Payment date</th>
                <th>EMI</th>
                <th>Principal</th>
                <th>Interest</th>
                <th>Prepayment</th>
                <th>Balance</th>
                <th>OD interest</th>
                <th>OD net utilized</th>
              </tr>
            </thead>
            <tbody>
              {group.rows.map(({ standard, od }) => (
                <tr key={standard.date}>
                  <td>{new Date(`${standard.date}T00:00:00Z`).toLocaleDateString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' })}</td>
                  <td>{formatCurrency(standard.emi)}</td>
                  <td>{formatCurrency(standard.principal)}</td>
                  <td>{formatCurrency(standard.interest)}</td>
                  <td>{formatCurrency(standard.prepayment)}</td>
                  <td>{formatCurrency(standard.balance)}</td>
                  <td>{formatCurrency(od?.interest ?? standard.interest)}</td>
                  <td>{formatCurrency(od?.netUtilized ?? standard.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </details>
  )
}

export function Schedule({ result }: { result: CalculationResult }) {
  const groups = useMemo(() => result.standard.schedule.reduce<YearGroup[]>((all, row, index) => {
    const year = row.date.slice(0, 4)
    let group = all.at(-1)
    if (!group || group.year !== year) {
      group = { year, rows: [] }
      all.push(group)
    }
    group.rows.push({ standard: row, od: result.od.schedule[index] })
    return all
  }, []), [result])

  return (
    <section className="schedule-section" aria-labelledby="schedule-title">
      <div className="section-heading-row">
        <div>
          <div className="section-kicker">AUDIT TRAIL</div>
          <h2 id="schedule-title">Amortization schedule</h2>
        </div>
        <span className="data-tag">{result.standard.schedule.length} MONTHS</span>
      </div>
      <p className="section-copy">Expand a calendar year to inspect every payment and closing balance.</p>
      <div className="year-list">
        {groups.map((group, index) => (
          <YearSchedule key={`${group.year}-${index === 0 ? 'open' : 'closed'}`} group={group} initiallyOpen={index === 0} />
        ))}
      </div>
    </section>
  )
}
