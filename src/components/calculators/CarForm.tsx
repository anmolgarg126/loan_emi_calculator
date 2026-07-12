import type { CarScenario } from '../../domain/calculators'
import type { SectionCostSummary } from '../../domain/calculators/cost-breakdown'
import { DateField, ModeToggle, NumberField, Switch } from '../CalculatorFields'
import { GuidedSection } from '../GuidedSection'
import { PrepaymentFields, RateChangeFields } from './LoanEventFields'

export function CarForm({ scenario, costs, onChange, issueFor }: {
  scenario: CarScenario
  costs: Record<string, SectionCostSummary>
  onChange: (scenario: CarScenario) => void
  issueFor: (field: string) => string | undefined
}) {
  const set = <K extends keyof CarScenario>(key: K, value: CarScenario[K]) => onChange({ ...scenario, [key]: value })
  const downPaymentAmount = scenario.downPaymentMode === 'percent' && scenario.vehiclePrice > 0
    ? (scenario.downPayment * scenario.vehiclePrice) / 100
    : undefined
  return <div className="guided-form">
    <GuidedSection step={1} title="Car loan essentials" description="On-road price, contribution, rate, and term" open>
      <div className="field-grid">
        <NumberField id="vehicle-price" label="Vehicle price" value={scenario.vehiclePrice} onChange={(value) => set('vehiclePrice', value)} prefix="₹" error={issueFor('vehiclePrice')} />
        <div className="field-with-mode"><NumberField id="car-down-payment" label="Down payment" value={scenario.downPayment} onChange={(value) => set('downPayment', value)} prefix={scenario.downPaymentMode === 'amount' ? '₹' : undefined} suffix={scenario.downPaymentMode === 'percent' ? '%' : undefined} amountValue={downPaymentAmount} equivalentAmount={scenario.downPaymentMode === 'percent'} error={issueFor('downPayment')} /><ModeToggle id="car-down-mode" value={scenario.downPaymentMode} onChange={(value) => set('downPaymentMode', value)} percentLabel="% of vehicle" error={issueFor('downPaymentMode')} /></div>
        <NumberField id="car-rate" label="Annual interest rate" value={scenario.annualRate} onChange={(value) => set('annualRate', value)} suffix="%" max={50} step={0.01} error={issueFor('annualRate')} />
        <NumberField id="car-tenure" label="Loan tenure" value={scenario.tenureMonths} onChange={(value) => set('tenureMonths', Math.round(value))} suffix="months" max={480} step={1} error={issueFor('tenureMonths')} />
        <DateField id="car-start" label="First EMI date" value={scenario.startDate} onChange={(value) => set('startDate', value)} error={issueFor('startDate')} />
      </div>
    </GuidedSection>
    <GuidedSection step={2} title="On-road financing" description="Registration, insurance, and lender fee" optional configured={scenario.registrationFees + scenario.financedInsurance + scenario.processingFee > 0} financial={costs.onRoad}>
      <div className="field-grid">
        <NumberField id="registration-fees" label="Registration and on-road fees" value={scenario.registrationFees} onChange={(value) => set('registrationFees', value)} prefix="₹" error={issueFor('registrationFees')} />
        <Switch id="finance-registration" checked={scenario.financeRegistrationFees} onChange={(value) => set('financeRegistrationFees', value)} label="Finance registration fees" description="Include them in principal instead of paying upfront." />
        <NumberField id="car-insurance" label="Financed insurance" value={scenario.financedInsurance} onChange={(value) => set('financedInsurance', value)} prefix="₹" error={issueFor('financedInsurance')} />
        <NumberField id="car-processing-fee" label="Processing fee" value={scenario.processingFee} onChange={(value) => set('processingFee', value)} prefix="₹" error={issueFor('processingFee')} />
      </div>
    </GuidedSection>
    <GuidedSection step={3} title="Balloon and ownership horizon" description="Keep the final obligation separate from expected resale" optional configured={scenario.balloonAmount + scenario.expectedResaleValue > 0 || scenario.ownershipMonths !== scenario.tenureMonths} financial={costs.balloon}>
      <div className="field-grid">
        <NumberField id="balloon-amount" label="Contractual balloon payment" value={scenario.balloonAmount} onChange={(value) => set('balloonAmount', value)} prefix="₹" error={issueFor('balloonAmount')} />
        <NumberField id="resale-value" label="Expected resale value" value={scenario.expectedResaleValue} onChange={(value) => set('expectedResaleValue', value)} prefix="₹" error={issueFor('expectedResaleValue')} />
        <NumberField id="ownership-months" label="Ownership horizon" value={scenario.ownershipMonths} onChange={(value) => set('ownershipMonths', Math.round(value))} suffix="months" max={scenario.tenureMonths} step={1} error={issueFor('ownershipMonths')} />
      </div>
    </GuidedSection>
    <GuidedSection step={4} title="Repayment changes" description="Prepayments and future rate resets" optional configured={scenario.prepayments.length + scenario.rateChanges.length > 0} financial={costs.repayment}>
      <h3>Prepayments</h3><PrepaymentFields items={scenario.prepayments} startDate={scenario.startDate} onChange={(value) => set('prepayments', value)} issueFor={issueFor} />
      <h3>Rate changes</h3><RateChangeFields items={scenario.rateChanges} startDate={scenario.startDate} onChange={(value) => set('rateChanges', value)} issueFor={issueFor} />
    </GuidedSection>
  </div>
}
