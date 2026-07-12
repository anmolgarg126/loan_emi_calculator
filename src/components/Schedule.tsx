import { useEffect, useMemo, useRef, useState } from 'react'
import type { UnifiedScheduleRow } from '../domain/calculators'
import { formatCurrency } from '../domain/loan'

interface YearGroup { year: string; rows: UnifiedScheduleRow[] }

function YearSchedule({ group, initiallyOpen, selectedPeriod, granularity, onSelectPeriod }: {
  group: YearGroup
  initiallyOpen: boolean
  selectedPeriod: string | null
  granularity: 'yearly' | 'monthly'
  onSelectPeriod: (period: string) => void
}) {
  const selected = selectedPeriod?.startsWith(group.year) ?? false
  const [open, setOpen] = useState(initiallyOpen || selected)
  const ref = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    if (!selected) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ref.current?.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' })
  }, [selected])
  const principal = group.rows.reduce((sum, row) => sum + row.principal + row.prepayment, 0)
  const interest = group.rows.reduce((sum, row) => sum + row.interest, 0)
  const balance = group.rows.at(-1)?.balance ?? 0
  return <details ref={ref} open={open || selected} onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary>
      <span className="year-label">{group.year}</span>
      <span><small>Principal</small><strong>{formatCurrency(principal)}</strong></span>
      <span><small>Interest</small><strong>{formatCurrency(interest)}</strong></span>
      <span><small>Closing</small><strong>{formatCurrency(balance)}</strong></span>
    </summary>
    {open && <div className="table-scroll"><table><thead><tr><th>Payment date</th><th>Payment</th><th>Principal</th><th>Interest</th><th>Prepayment</th><th>Costs</th><th>Balance</th><th>OD net utilized</th></tr></thead><tbody>{group.rows.map((row) => {
      const key = granularity === 'monthly' ? row.date.slice(0, 7) : group.year
      const rowSelected = selectedPeriod === key
      return <tr key={`${row.date}-${row.period}`} tabIndex={0} aria-selected={rowSelected} className={rowSelected ? 'selected-row' : ''} onFocus={() => onSelectPeriod(key)} onClick={() => onSelectPeriod(key)}><td>{new Date(`${row.date}T00:00:00Z`).toLocaleDateString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' })}</td><td>{formatCurrency(row.payment)}</td><td>{formatCurrency(row.principal)}</td><td>{formatCurrency(row.interest)}</td><td>{formatCurrency(row.prepayment)}</td><td>{formatCurrency(row.costs)}</td><td>{formatCurrency(row.balance)}</td><td>{row.odNetUtilized === undefined ? 'Not applicable' : formatCurrency(row.odNetUtilized)}</td></tr>
    })}</tbody></table></div>}
  </details>
}

export function Schedule({ schedule, selectedPeriod, granularity, onSelectPeriod }: {
  schedule: UnifiedScheduleRow[]
  selectedPeriod: string | null
  granularity: 'yearly' | 'monthly'
  onSelectPeriod: (period: string) => void
}) {
  const groups = useMemo(() => schedule.reduce<YearGroup[]>((all, row) => {
    const year = row.date.slice(0, 4)
    let group = all.at(-1)
    if (!group || group.year !== year) {
      group = { year, rows: [] }
      all.push(group)
    }
    group.rows.push(row)
    return all
  }, []), [schedule])
  return <section className="suite-schedule" aria-labelledby="schedule-title">
    <div className="section-heading"><div><h2 id="schedule-title">Payment schedule</h2><p>Expand a year to inspect each payment and connect it with the graph.</p></div><span>{schedule.length} payments</span></div>
    <div className="year-list">{groups.map((group, index) => <YearSchedule key={group.year} group={group} initiallyOpen={index === 0} selectedPeriod={selectedPeriod} granularity={granularity} onSelectPeriod={onSelectPeriod} />)}</div>
  </section>
}
