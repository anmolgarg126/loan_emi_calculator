import type { SuiteResult } from '../domain/calculators'
import type { GraphState } from '../lib/suite-state'
import { PaymentGraph } from './PaymentGraph'
import { Schedule } from './Schedule'

export default function AnalysisDetails({ result, graph, onGraphChange, onSelectPeriod }: {
  result: SuiteResult
  graph: GraphState
  onGraphChange: (patch: Partial<GraphState>) => void
  onSelectPeriod: (period: string | null) => void
}) {
  return <>
    <PaymentGraph result={result} graphState={graph} onGraphStateChange={onGraphChange} onSelectPeriod={onSelectPeriod} />
    <Schedule schedule={result.view.schedule} selectedPeriod={graph.selectedPeriod} granularity={graph.granularity} onSelectPeriod={(period) => onSelectPeriod(period)} />
  </>
}
