import type { Prepayment, RateChange } from '../../domain/loan'
import { DateField, NumberField, SelectField } from '../CalculatorFields'

const id = () => crypto.randomUUID()
type IssueFor = (field: string) => string | undefined

export function PrepaymentFields({ items, startDate, onChange, issueFor }: {
  items: Prepayment[]
  startDate: string
  onChange: (items: Prepayment[]) => void
  issueFor: IssueFor
}) {
  const update = (index: number, patch: Partial<Prepayment>) => onChange(items.map((item, position) => position === index ? { ...item, ...patch } : item))
  return (
    <div className="entry-editor">
      {items.map((item, index) => (
        <div className="entry-row" key={item.id}>
          <DateField id={`prepayment-${item.id}-date`} label="Payment date" value={item.date} onChange={(date) => update(index, { date })} error={issueFor(`prepayments.${item.id}.date`)} />
          <NumberField id={`prepayment-${item.id}-amount`} label="Extra amount" value={item.amount} onChange={(amount) => update(index, { amount })} prefix="₹" error={issueFor(`prepayments.${item.id}.amount`)} />
          <SelectField id={`prepayment-${item.id}-frequency`} label="Frequency" value={item.frequency} onChange={(frequency) => update(index, { frequency: frequency as Prepayment['frequency'] })} error={issueFor(`prepayments.${item.id}.frequency`)}>
            <option value="once">Once</option><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="yearly">Yearly</option>
          </SelectField>
          <button type="button" className="remove-button" onClick={() => onChange(items.filter((_, position) => position !== index))}>Remove</button>
        </div>
      ))}
      <button type="button" className="secondary-button" disabled={items.length >= 100} onClick={() => onChange([...items, { id: id(), date: startDate, amount: 0, frequency: 'once' }])}>Add prepayment</button>
    </div>
  )
}

export function RateChangeFields({ items, startDate, onChange, issueFor }: {
  items: RateChange[]
  startDate: string
  onChange: (items: RateChange[]) => void
  issueFor: IssueFor
}) {
  const update = (index: number, patch: Partial<RateChange>) => onChange(items.map((item, position) => position === index ? { ...item, ...patch } : item))
  return (
    <div className="entry-editor">
      {items.map((item, index) => (
        <div className="entry-row" key={item.id}>
          <DateField id={`rate-${item.id}-date`} label="Effective date" value={item.date} onChange={(date) => update(index, { date })} error={issueFor(`rateChanges.${item.id}.date`)} />
          <NumberField id={`rate-${item.id}-value`} label="New annual rate" value={item.annualRate} onChange={(annualRate) => update(index, { annualRate })} suffix="%" max={50} step={0.01} error={issueFor(`rateChanges.${item.id}.annualRate`)} />
          <SelectField id={`rate-${item.id}-mode`} label="Adjustment" value={item.mode} onChange={(mode) => update(index, { mode: mode as RateChange['mode'] })} error={issueFor(`rateChanges.${item.id}.mode`)}>
            <option value="keep-emi">Keep EMI, adjust tenure</option><option value="keep-tenure">Keep tenure, adjust EMI</option>
          </SelectField>
          <button type="button" className="remove-button" onClick={() => onChange(items.filter((_, position) => position !== index))}>Remove</button>
        </div>
      ))}
      <button type="button" className="secondary-button" disabled={items.length >= 100} onClick={() => onChange([...items, { id: id(), date: startDate, annualRate: 0, mode: 'keep-emi' }])}>Add rate change</button>
    </div>
  )
}
