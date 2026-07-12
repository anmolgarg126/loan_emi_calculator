import { addMonths } from '../../domain/loan'
import type { EducationDisbursement, EducationScenario } from '../../domain/calculators'
import { DateField, NumberField, SelectField } from '../CalculatorFields'
import { GuidedSection } from '../GuidedSection'
import { PrepaymentFields } from './LoanEventFields'

const id = () => crypto.randomUUID()

export function EducationForm({ scenario, onChange, issueFor }: {
  scenario: EducationScenario
  onChange: (scenario: EducationScenario) => void
  issueFor: (field: string) => string | undefined
}) {
  const set = <K extends keyof EducationScenario>(key: K, value: EducationScenario[K]) => onChange({ ...scenario, [key]: value })
  const updateDisbursement = (index: number, patch: Partial<EducationDisbursement>) => set('disbursements', scenario.disbursements.map((item, position) => position === index ? { ...item, ...patch } : item))
  const repaymentStart = addMonths(scenario.startDate, scenario.studyMonths + scenario.moratoriumMonths)
  return <div className="guided-form">
    <GuidedSection step={1} title="Study funding" description="Course cost, contribution, and dated lender disbursements" open>
      <div className="field-grid">
        <NumberField id="course-cost" label="Course cost" value={scenario.courseCost} onChange={(value) => set('courseCost', value)} prefix="₹" error={issueFor('courseCost')} />
        <NumberField id="own-contribution" label="Own contribution" value={scenario.ownContribution} onChange={(value) => set('ownContribution', value)} prefix="₹" error={issueFor('ownContribution')} />
        <DateField id="education-start" label="Study start date" value={scenario.startDate} onChange={(value) => set('startDate', value)} error={issueFor('startDate')} />
        <NumberField id="study-months" label="Study period" value={scenario.studyMonths} onChange={(value) => set('studyMonths', Math.round(value))} suffix="months" max={120} step={1} error={issueFor('studyMonths')} />
        <NumberField id="study-rate" label="Study-period annual rate" value={scenario.studyAnnualRate} onChange={(value) => set('studyAnnualRate', value)} suffix="%" max={50} step={0.01} error={issueFor('studyAnnualRate')} />
      </div>
      <h3>Dated disbursements</h3>
      <div className="entry-editor">
        {scenario.disbursements.map((item, index) => <div className="entry-row" key={item.id}>
          <DateField id={`disbursement-${item.id}-date`} label="Disbursement date" value={item.date} onChange={(date) => updateDisbursement(index, { date })} error={issueFor(`disbursements.${index}.date`)} />
          <NumberField id={`disbursement-${item.id}-amount`} label="Amount" value={item.amount} onChange={(amount) => updateDisbursement(index, { amount })} prefix="₹" error={issueFor(`disbursements.${index}.amount`)} />
          <button type="button" className="remove-button" disabled={scenario.disbursements.length === 1} onClick={() => set('disbursements', scenario.disbursements.filter((_, position) => position !== index))}>Remove</button>
        </div>)}
        <button type="button" className="secondary-button" disabled={scenario.disbursements.length >= 100} onClick={() => set('disbursements', [...scenario.disbursements, { id: id(), date: scenario.startDate, amount: 0 }])}>Add disbursement</button>
      </div>
    </GuidedSection>
    <GuidedSection step={2} title="Moratorium servicing" description="Choose how study-period interest is handled" open>
      <div className="field-grid">
        <NumberField id="moratorium-months" label="Moratorium after study" value={scenario.moratoriumMonths} onChange={(value) => set('moratoriumMonths', Math.round(value))} suffix="months" max={60} step={1} error={issueFor('moratoriumMonths')} />
        <SelectField id="servicing-mode" label="Interest servicing" value={scenario.servicingMode} onChange={(value) => set('servicingMode', value as EducationScenario['servicingMode'])} error={issueFor('servicingMode')}><option value="none">Do not service</option><option value="full-interest">Pay full accrued interest monthly</option><option value="fixed-monthly">Pay a fixed monthly amount</option></SelectField>
        {scenario.servicingMode === 'fixed-monthly' && <NumberField id="servicing-amount" label="Monthly servicing amount" value={scenario.servicingAmount} onChange={(value) => set('servicingAmount', value)} prefix="₹" error={issueFor('servicingAmount')} />}
      </div>
    </GuidedSection>
    <GuidedSection step={3} title="Repayment" description="Rate, term, fees, and optional prepayments" open>
      <div className="field-grid">
        <NumberField id="repayment-rate" label="Repayment annual rate" value={scenario.repaymentAnnualRate} onChange={(value) => set('repaymentAnnualRate', value)} suffix="%" max={50} step={0.01} error={issueFor('repaymentAnnualRate')} />
        <NumberField id="repayment-tenure" label="Repayment tenure" value={scenario.repaymentTenureMonths} onChange={(value) => set('repaymentTenureMonths', Math.round(value))} suffix="months" max={480} step={1} error={issueFor('repaymentTenureMonths')} />
        <NumberField id="education-fee" label="Processing fee" value={scenario.processingFee} onChange={(value) => set('processingFee', value)} prefix="₹" error={issueFor('processingFee')} />
      </div>
      <h3>Repayment prepayments</h3><PrepaymentFields items={scenario.prepayments} startDate={repaymentStart} onChange={(value) => set('prepayments', value)} issueFor={issueFor} />
    </GuidedSection>
  </div>
}
