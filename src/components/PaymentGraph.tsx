import { useId, useMemo, useState } from 'react'
import type { SuiteResult } from '../domain/calculators'
import { aggregateGraphPeriods, type GraphPeriod } from '../domain/calculators/graph'
import { formatCurrency } from '../domain/loan'
import type { GraphState } from '../lib/suite-state'

const series = [
  { key: 'principal', label: 'Principal', color: 'var(--chart-principal)' },
  { key: 'prepayment', label: 'Prepayments', color: 'var(--chart-prepayment)' },
  { key: 'interest', label: 'Interest', color: 'var(--chart-interest)' },
  { key: 'costs', label: 'Costs', color: 'var(--chart-costs)' },
] as const

const pointPath = (periods: GraphPeriod[], x: (index: number) => number, y: (value: number) => number, key: 'balance' | 'odNetUtilized') => periods
  .map((period, index) => `${index === 0 ? 'M' : 'L'} ${x(index)} ${y(key === 'balance' ? period.balance : period.odNetUtilized ?? period.balance)}`)
  .join(' ')

export function PaymentGraph({ result, graphState, onGraphStateChange, onSelectPeriod }: {
  result: SuiteResult
  graphState: GraphState
  onGraphStateChange: (patch: Partial<GraphState>) => void
  onSelectPeriod: (period: string | null) => void
}) {
  const summaryId = useId()
  const tooltipId = useId()
  const [activePeriod, setActivePeriod] = useState<string | null>(null)
  const periods = useMemo(() => aggregateGraphPeriods(result.view.schedule, graphState.granularity), [graphState.granularity, result.view.schedule])
  const finalIndex = Math.max(0, periods.length - 1)
  const rangeStart = Math.min(Math.max(0, Math.round(graphState.rangeStart)), Math.max(0, finalIndex - 1))
  const rangeEnd = Math.min(Math.max(rangeStart + 1, Math.round(graphState.rangeEnd)), finalIndex)
  const visible = periods.slice(rangeStart, rangeEnd + 1)
  const selected = periods.find((period) => period.key === (activePeriod ?? graphState.selectedPeriod))
  const hidden = new Set(graphState.hiddenSeries)
  const width = 1000
  const height = 430
  const left = 72
  const right = 70
  const top = 36
  const bottom = 62
  const plotWidth = width - left - right
  const plotHeight = height - top - bottom
  const maxFlow = Math.max(1, ...visible.map((period) => series.reduce((sum, item) => sum + (hidden.has(item.key) ? 0 : period[item.key]), 0)))
  const maxBalance = Math.max(1, ...visible.flatMap((period) => [period.balance, graphState.compareOd ? period.odNetUtilized ?? 0 : 0]))
  const slot = plotWidth / Math.max(1, visible.length)
  const barWidth = Math.max(1.5, Math.min(28, slot * .62))
  const x = (index: number) => left + slot * index + slot / 2
  const flowY = (value: number) => top + plotHeight - value / maxFlow * plotHeight
  const balanceY = (value: number) => top + plotHeight - value / maxBalance * plotHeight
  const hasOd = periods.some((period) => period.odNetUtilized !== undefined)
  const totalPrincipal = periods.reduce((sum, period) => sum + period.principal + period.prepayment, 0)
  const totalInterest = periods.reduce((sum, period) => sum + period.interest, 0)
  const selectedIndex = selected ? visible.findIndex((period) => period.key === selected.key) : -1
  const tooltipLines = selected ? [
    `Payment ${formatCurrency(selected.payment + selected.prepayment + selected.costs)}`,
    `Principal ${formatCurrency(selected.principal)}`,
    `Prepayments ${formatCurrency(selected.prepayment)}`,
    `Interest ${formatCurrency(selected.interest)}`,
    `Costs ${formatCurrency(selected.costs)}`,
    `Closing balance ${formatCurrency(selected.balance)}`,
    ...(graphState.compareOd ? [`OD net utilized ${formatCurrency(selected.odNetUtilized ?? selected.balance)}`] : []),
  ] : []
  const tooltipWidth = 238
  const tooltipHeight = 42 + tooltipLines.length * 18
  const activeX = selectedIndex >= 0 ? x(selectedIndex) : 0
  const activeBalanceY = selected ? balanceY(selected.balance) : 0
  const activeFlowTop = selected ? flowY(series.reduce((sum, item) => sum + (hidden.has(item.key) ? 0 : selected[item.key]), 0)) : 0
  const tooltipX = Math.min(Math.max(activeX - tooltipWidth / 2, left + 8), width - right - tooltipWidth - 8)
  const tooltipY = Math.max(top + 8, Math.min(activeFlowTop, activeBalanceY) - tooltipHeight - 12)

  const activate = (period: GraphPeriod | null) => onSelectPeriod(period?.key ?? null)

  return <section className="payment-graph" aria-labelledby="graph-title" aria-describedby={summaryId}>
    <div className="section-heading graph-heading"><div><h2 id="graph-title">Payment trajectory</h2><p>Stacked payments and the remaining balance across your selected range.</p></div><div className="graph-granularity" aria-label="Graph granularity"><button type="button" aria-label="Yearly graph" aria-pressed={graphState.granularity === 'yearly'} onClick={() => onGraphStateChange({ granularity: 'yearly', rangeStart: 0, rangeEnd: Number.MAX_SAFE_INTEGER, selectedPeriod: null })}>Yearly</button><button type="button" aria-label="Monthly graph" aria-pressed={graphState.granularity === 'monthly'} onClick={() => onGraphStateChange({ granularity: 'monthly', rangeStart: 0, rangeEnd: Number.MAX_SAFE_INTEGER, selectedPeriod: null })}>Monthly</button></div></div>
    <p id={summaryId} className="sr-summary">Starting balance {formatCurrency(result.view.schedule[0]?.balance ?? 0)}. Final balance {formatCurrency(result.view.schedule.at(-1)?.balance ?? 0)}. Total principal {formatCurrency(totalPrincipal)}. Total interest {formatCurrency(totalInterest)}.</p>
    <div className="graph-controls">
      <div className="graph-legend" aria-label="Graph series">
        {series.map((item) => {
          const isHidden = hidden.has(item.key)
          return <button type="button" key={item.key} aria-label={`${isHidden ? 'Show' : 'Hide'} ${item.label.toLowerCase()}`} aria-pressed={!isHidden} onClick={() => onGraphStateChange({ hiddenSeries: isHidden ? graphState.hiddenSeries.filter((key) => key !== item.key) : [...graphState.hiddenSeries, item.key] })}><span style={{ background: item.color }} aria-hidden="true" />{isHidden ? 'Show' : 'Hide'} {item.label}</button>
        })}
        <span className="line-legend-item"><i className="balance-key" />Balance</span>
        {hasOd && <button type="button" aria-label="Compare OD balance" aria-pressed={graphState.compareOd} onClick={() => onGraphStateChange({ compareOd: !graphState.compareOd })}><span className="od-key" aria-hidden="true" />Compare OD balance</button>}
      </div>
      {periods.length > 1 && <div className="range-controls"><label>First visible period<input type="range" aria-label="First visible period" min={0} max={Math.max(0, finalIndex - 1)} value={rangeStart} onChange={(event) => onGraphStateChange({ rangeStart: Math.min(Number(event.target.value), rangeEnd - 1) })} /></label><label>Last visible period<input type="range" aria-label="Last visible period" min={1} max={finalIndex} value={rangeEnd} onChange={(event) => onGraphStateChange({ rangeEnd: Math.max(Number(event.target.value), rangeStart + 1) })} /></label></div>}
    </div>
    <div className="graph-scroll">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Stacked loan payments with closing balance line">
        {[0, .25, .5, .75, 1].map((ratio) => <g key={ratio}><line className="graph-gridline" x1={left} x2={width - right} y1={flowY(maxFlow * ratio)} y2={flowY(maxFlow * ratio)} /><text className="graph-axis" x={left - 10} y={flowY(maxFlow * ratio) + 4} textAnchor="end">{Math.round(maxFlow * ratio / 1000)}k</text><text className="graph-axis" x={width - right + 10} y={balanceY(maxBalance * ratio) + 4}>{Math.round(maxBalance * ratio / 100_000)}L</text></g>)}
        {visible.map((period, index) => {
          let stacked = 0
          const targetX = x(index)
          const labelEvery = Math.max(1, Math.ceil(visible.length / 12))
          return <g key={period.key} data-period={period.key} role="button" tabIndex={0} aria-label={`${period.label} payment details. Payment ${formatCurrency(period.payment)}, interest ${formatCurrency(period.interest)}, closing balance ${formatCurrency(period.balance)}.`} aria-describedby={selected?.key === period.key ? tooltipId : undefined} onFocus={() => setActivePeriod(period.key)} onBlur={() => setActivePeriod(null)} onMouseEnter={() => setActivePeriod(period.key)} onMouseLeave={(event) => { if (document.activeElement !== event.currentTarget) setActivePeriod(null) }} onClick={() => { setActivePeriod(period.key); activate(period) }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setActivePeriod(period.key); activate(period) } if (event.key === 'Escape') { setActivePeriod(null); activate(null) } }}>
            <rect x={targetX - Math.max(22, slot / 2)} y={top} width={Math.max(44, slot)} height={plotHeight} fill="transparent" />
            {series.map((item) => {
              if (hidden.has(item.key) || period[item.key] <= 0) return null
              const value = period[item.key]
              const yTop = flowY(stacked + value)
              const barHeight = flowY(stacked) - yTop
              stacked += value
              return <rect key={item.key} data-series={item.key} x={targetX - barWidth / 2} y={yTop} width={barWidth} height={Math.max(.5, barHeight)} fill={item.color} />
            })}
            {(index % labelEvery === 0 || index === visible.length - 1) && <text className="graph-axis graph-x-label" x={targetX} y={height - 28} textAnchor="middle">{period.label}</text>}
          </g>
        })}
        {visible.length > 0 && <path className="balance-line" d={pointPath(visible, x, balanceY, 'balance')} />}
        {graphState.compareOd && visible.length > 0 && <path className="od-balance-line" d={pointPath(visible, x, balanceY, 'odNetUtilized')} />}
        {selected && selectedIndex >= 0 && <g id={tooltipId} role="tooltip" className="graph-tooltip-svg">
          <line className="graph-crosshair" x1={activeX} x2={activeX} y1={top} y2={top + plotHeight} />
          <line className="graph-crosshair" x1={left} x2={width - right} y1={activeBalanceY} y2={activeBalanceY} />
          <circle className="graph-active-point" cx={activeX} cy={activeBalanceY} r={5} />
          <g transform={`translate(${tooltipX} ${tooltipY})`}>
            <rect className="graph-tooltip-box" width={tooltipWidth} height={tooltipHeight} rx={6} />
            <text className="graph-tooltip-title" x={12} y={22}>{selected.label}</text>
            {tooltipLines.map((line, index) => <text className="graph-tooltip-line" key={line} x={12} y={44 + index * 18}>{line}</text>)}
          </g>
        </g>}
      </svg>
    </div>
    <p className="graph-note">The payment schedule below is the equivalent accessible data view.</p>
  </section>
}
