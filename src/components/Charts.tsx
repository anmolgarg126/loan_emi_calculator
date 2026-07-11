import { formatCurrency, type CalculationResult } from '../domain/loan'

const COLORS = ['#143f34', '#d66b3d', '#cabd76', '#567d72']

export function CostChart({ result }: { result: CalculationResult }) {
  const data = [
    { name: 'Principal', value: result.loanAmount },
    { name: 'Interest', value: result.standard.totalInterest },
    { name: 'Upfront costs', value: result.upfrontCash },
    { name: 'Ownership costs', value: result.ownershipCostOverOriginalTenure },
  ].filter((item) => item.value > 0)
  const total = data.reduce((sum, item) => sum + item.value, 0)
  const radius = 78
  const circumference = 2 * Math.PI * radius
  let offset = 0

  return (
    <section className="chart-panel" aria-labelledby="cost-chart-title">
      <div className="section-kicker">COST COMPOSITION</div>
      <h3 id="cost-chart-title">Where the standard-loan money goes</h3>
      <div className="chart-frame" role="img" aria-label="Standard loan cost composition chart">
        <svg viewBox="0 0 240 240" aria-hidden="true">
          <circle cx="120" cy="120" r={radius} fill="none" stroke="#d5d0c4" strokeWidth="28" />
          {data.map((item, index) => {
            const length = (item.value / total) * circumference
            const segment = (
              <circle
                key={item.name}
                cx="120"
                cy="120"
                r={radius}
                fill="none"
                stroke={COLORS[index % COLORS.length]}
                strokeWidth="28"
                strokeDasharray={`${length} ${circumference - length}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 120 120)"
              />
            )
            offset += length
            return segment
          })}
          <text x="120" y="112" textAnchor="middle" className="donut-label">TOTAL</text>
          <text x="120" y="136" textAnchor="middle" className="donut-value">{formatCurrency(total)}</text>
        </svg>
      </div>
      <ul className="chart-legend" aria-label="Cost composition values">
        {data.map((item, index) => (
          <li key={item.name}>
            <span className="legend-swatch" style={{ background: COLORS[index % COLORS.length] }} />
            <span>{item.name}</span>
            <strong>{formatCurrency(item.value)}</strong>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function BalanceChart({ result }: { result: CalculationResult }) {
  const step = Math.max(1, Math.ceil(result.standard.schedule.length / 60))
  const data = result.standard.schedule.flatMap((row, index) =>
    index % step === 0 || index === result.standard.schedule.length - 1
      ? [{ label: row.date.slice(0, 7), standard: row.balance, od: result.od.schedule[index]?.netUtilized ?? row.balance }]
      : [],
  )
  const width = 800
  const height = 280
  const pad = 34
  const max = Math.max(result.loanAmount, 1)
  const x = (index: number) => pad + (index / Math.max(1, data.length - 1)) * (width - pad * 2)
  const y = (value: number) => height - pad - (value / max) * (height - pad * 2)
  const standardPoints = data.map((item, index) => `${x(index)},${y(item.standard)}`).join(' ')
  const odPoints = data.map((item, index) => `${x(index)},${y(item.od)}`).join(' ')

  return (
    <section className="chart-panel chart-panel-wide" aria-labelledby="balance-chart-title">
      <div className="section-kicker">BALANCE TRAJECTORY</div>
      <h3 id="balance-chart-title">Contractual balance vs. net OD utilization</h3>
      <div className="balance-chart" role="img" aria-label="Standard balance and OD net utilization over time">
        <svg viewBox={`0 0 ${width} ${height}`} aria-hidden="true" preserveAspectRatio="none">
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
            <g key={ratio}>
              <line x1={pad} x2={width - pad} y1={y(max * ratio)} y2={y(max * ratio)} className="grid-line" />
              <text x={0} y={y(max * ratio) + 4} className="axis-label">{Math.round((max * ratio) / 100_000)}L</text>
            </g>
          ))}
          <polyline points={standardPoints} className="standard-line" />
          <polyline points={odPoints} className="od-line" />
        </svg>
      </div>
      <div className="line-legend" aria-hidden="true">
        <span><i className="standard-key" />Standard balance</span>
        <span><i className="od-key" />OD net utilized</span>
      </div>
      <p className="chart-note">The amortization table below is the accessible data alternative for this chart.</p>
    </section>
  )
}
