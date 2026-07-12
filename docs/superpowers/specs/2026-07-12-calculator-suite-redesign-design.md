# Loan Calculator Suite and Interface Redesign

**Date:** 2026-07-12
**Status:** Approved
**Product:** Loan Ledger
**Platform:** Static React/Vite application on GitHub Pages

## 1. Objective

Turn the existing advanced Home Loan EMI and overdraft calculator into a broader lender-neutral loan calculator suite while making the interface calmer, clearer, and easier to use.

The redesigned product must:

- support Generic, Home, Car, Personal, and Education loan calculators;
- provide Affordability, Prepayment, Tenure, and Interest Rate solvers;
- retain the complete Home Loan ownership-cost, rate-change, prepayment, and OD model;
- add an interactive payment-schedule graph with deep schedule integration;
- remain fully client-side and independently isolated in each open browser tab;
- keep the existing accuracy, accessibility, performance, export, and GitHub Pages guarantees.

Amount-input editing and Indian formatting are further specified by `2026-07-12-indian-amount-inputs-design.md`. Monetary inputs use Indian digit grouping outside active editing, may be cleared without a persistent leading zero, and expose readable rupee words. Percentage-based amount inputs show their calculated rupee equivalent and words; pure rates and tenures do not.

Section-level monthly/one-time summaries, loan composition, total other charges, total loan payable, and total all-in outflow are further specified by `2026-07-12-section-cost-breakdowns-design.md`. These values derive from validated calculator results and must not double-count financed charges, deductions, capitalized interest, balloons, or prepayments.

## 2. Approved design direction

The visual direction combines:

- the calm teal, cool-neutral, system-sans palette from the approved “Calm financial workspace” concept;
- the guided, progressive layout from the approved “Guided borrower planner” concept;
- the approved “Presets + tool drawer” suite structure.

The reference at <https://emicalculator.net/home-loan-emi-calculator/> informed the useful product patterns—grouped inputs, immediate payment results, payment composition, a yearly graph, a schedule, and exports. The redesign will not reproduce its branding, colors, page structure, or visual treatment.

## 3. Product information architecture

### 3.1 Primary calculators

An accessible tab list selects one of:

1. Generic
2. Home
3. Car
4. Personal
5. Education

The selected calculator is represented by `?calculator=<type>`. Query-based selection works on GitHub Pages without route rewrites. The URL fragment remains reserved for explicitly shared scenario data.

### 3.2 Solver tools

The following tools remain visible near the preset tabs without competing with the active calculator:

- Affordability
- Prepayment
- Tenure
- Interest Rate

Desktop uses a compact tool strip or drawer. Mobile uses a labelled tools control that opens an inline list, not a modal.

### 3.3 Page hierarchy

The active calculator page contains:

1. product header and client-only privacy status;
2. calculator preset tabs;
3. solver shortcuts;
4. calculator title and plain-language description;
5. guided input steps;
6. current result summary;
7. interactive payment graph;
8. comparison and composition summaries;
9. amortization schedule;
10. share, print, CSV, and typed XLSX actions;
11. privacy and educational notes.

## 4. Calculator modules

All calculators expose a common typed result contract for headline results, cash-flow components, schedules, charts, exports, sharing, and print. Calculator-specific modules own defaults, fields, validation, calculation adapters, result labels, and export assumptions.

### 4.1 Generic Loan EMI

Inputs:

- loan principal;
- annual reducing-balance interest rate;
- tenure in months or years;
- first EMI date;
- optional processing fee;
- optional prepayments;
- optional rate changes using keep-EMI or keep-tenure behavior.

Outputs:

- EMI;
- total interest;
- total repayment;
- payoff date;
- effective cost including fees;
- monthly and yearly amortization.

### 4.2 Home Loan

The existing audited Home Loan model remains authoritative and gains the redesigned shell and graph.

Inputs include:

- home value and amount/percentage down payment;
- loan-funded insurance;
- interest, tenure, and first EMI date;
- processing fee and one-time costs;
- property tax, home insurance, maintenance, and monthly ownership costs;
- dated and recurring prepayments;
- keep-EMI and keep-tenure rate changes;
- optional OD premium, setup fee, annual fee, opening parked amount/percentage, monthly contribution, and arbitrary dated deposits/withdrawals.

OD remains off by default. The default rate-change behavior keeps EMI unchanged and adjusts tenure.

### 4.3 Car Loan

Inputs:

- vehicle price;
- amount/percentage down payment;
- registration and on-road fees;
- first-year or financed insurance;
- annual interest rate and tenure;
- optional processing fee;
- optional contractual balloon payment;
- expected resale value at the selected ownership horizon;
- optional prepayments and rate changes.

Rules:

- financed principal equals financed vehicle/on-road costs minus down payment;
- a balloon is an explicit final contractual payment and uses the standard present-value payment formula with a future balance;
- expected resale value does not reduce loan principal unless the user explicitly models it as the balloon source;
- net ownership cost equals cash outflows through the ownership horizon minus expected resale proceeds.

Outputs distinguish EMI, balloon obligation, financing cost, cash paid, and estimated net ownership cost.

### 4.4 Personal Loan

Inputs:

- requested principal;
- annual quoted rate;
- reducing-balance or flat-rate quotation mode;
- tenure;
- processing fee amount/percentage;
- GST rate applied to the processing fee;
- optional insurance or deducted charges;
- optional prepayments.

Rules:

- net disbursed amount equals requested principal minus upfront deducted fees, GST, insurance, and charges;
- reducing-balance mode uses the common EMI engine;
- flat-rate mode computes total quoted interest on original principal and converts it to equal payments;
- effective APR is solved from net disbursal and the dated borrower cash flows, not copied from the quoted rate.

Outputs visibly compare quoted rate, effective APR, EMI, net amount received, total deductions, and total repayment.

### 4.5 Education Loan

Inputs:

- course cost and own contribution;
- dated loan disbursements, capped at 100 entries;
- annual study-period interest rate;
- study period in months;
- moratorium in months;
- interest-servicing choice: none, full accrued interest, or a fixed monthly contribution;
- repayment-period interest rate and tenure;
- optional processing fee and prepayments.

Rules:

- each dated disbursement increases outstanding principal on its date;
- study and moratorium interest accrue on actual outstanding disbursed principal using Actual/365 simple interest;
- servicing payments reduce accrued interest but never silently reduce principal;
- unpaid accrued interest capitalizes once at repayment start;
- repayment then uses the common reducing-balance EMI engine;
- all phase transitions and capitalized amounts are visible in the schedule.

Outputs distinguish total disbursed, serviced interest, capitalized interest, repayment-start principal, EMI, and total cost.

## 5. Solver tools

### 5.1 Affordability

Given a maximum monthly EMI, rate, tenure, and optional upfront costs, solve the maximum principal using the inverse annuity formula. Show the result as an estimate, not lending eligibility.

### 5.2 Tenure

Given principal, rate, and target EMI, solve the number of monthly payments. Reject an EMI that does not cover first-period interest.

### 5.3 Interest Rate

Given principal, EMI, and tenure, solve the implied annual reducing-balance rate with bounded bisection. Report when no valid rate exists within the supported range.

### 5.4 Prepayment

Compare the baseline schedule with one-time or recurring prepayments. Support both keep-EMI/shorten-tenure and keep-tenure/reduce-EMI outcomes where mathematically valid.

## 6. Guided interaction model

### 6.1 Progressive steps

The common path opens only the essential first step. Advanced sections are labelled in plain language, for example:

- “Optional — add ownership costs”
- “Optional — add prepayments or rate changes”
- “Optional — model an overdraft facility”

Collapsed summaries show whether a section is unused or configured. Opening a section never clears its values.

### 6.2 Result behavior

Desktop keeps the result summary visible beside the input flow. Mobile places the result directly after the essential first step, followed by advanced inputs, graph, and schedule.

When the current scenario is invalid:

- field errors appear beside responsible controls;
- the last valid estimate may remain visible but is explicitly labelled as previous;
- share, print, CSV, and XLSX actions are disabled;
- focus moves to the first invalid control only after an explicit solver/action attempt, not on every keystroke.

### 6.3 Reset and saved-data controls

**Reset calculator** restores:

- the active calculator defaults;
- active solver state;
- graph range and series visibility;
- Standard/OD comparison state;
- transient messages and validation state.

Reset offers a temporary **Undo reset** action. It does not delete remembered data.

**Delete saved scenario** is a separate privacy action. It requires confirmation and deletes only the locally remembered snapshot.

## 7. Interactive payment graph

The graph is a dependency-free responsive SVG generated from the same typed schedule used by tables and exports.

### 7.1 Series

The yearly or monthly stacked bars use relevant components for the active calculator:

- principal;
- prepayments;
- interest;
- calculator-specific costs, such as ownership costs or fees.

A line shows remaining balance. Home OD comparison can additionally show standard balance and OD net utilization without relying on color alone.

### 7.2 Interaction

- yearly/monthly view toggle;
- hover, focus, and tap tooltips with exact localized values;
- clickable keyboard-operable legend to show or hide series;
- accessible date-range controls for focused exploration;
- Standard vs OD comparison toggle when OD is enabled;
- selecting a year highlights it and opens/scrolls to matching schedule rows;
- schedule selection highlights the corresponding graph period;
- Escape clears a transient tooltip or selection;
- reduced motion removes animated transitions.

### 7.3 Accessibility

The graph has a concise text summary, labelled controls, keyboard navigation, visible focus, non-color series markers, and the complete schedule table as an equivalent data view. Interactive targets meet 44 px sizing on touch layouts.

## 8. Visual system

### 8.1 Physical scene and strategy

The primary user is reviewing a major financial decision on a laptop or phone in ordinary daylight, often for an extended session and with some anxiety about the numbers. This requires a light, calm, high-contrast product surface rather than a dramatic dark theme or decorative editorial page.

The color strategy is restrained:

- cool near-white application background;
- white primary work surfaces;
- deep blue-green text;
- calm teal for selected state, primary action, graph emphasis, and focus support;
- muted orange, violet, and green only for distinct graph series;
- explicit semantic colors for errors, warnings, success, disabled, and information states.

### 8.2 Typography and spacing

- system UI sans-serif stack only; no remote font requests;
- tabular numerals for currency, rates, dates, and schedules;
- fixed product type scale rather than oversized fluid display type;
- base mobile input text of at least 16 px;
- 4/8 px spacing system;
- 6–12 px radii for controls and panels;
- minimal, bounded shadows used only for hierarchy;
- no decorative grid, glassmorphism, gradient text, oversized hero, repeated eyebrow labels, or side-stripe callouts.

### 8.3 Responsive behavior

- no horizontal page scrolling at 320 px and above;
- preset tabs can scroll horizontally with the selected tab kept visible;
- solver tools collapse to a labelled inline disclosure on small screens;
- charts reduce label density before reducing text size;
- schedule tables use their existing contained horizontal scroller;
- all controls preserve visible focus and 44 px minimum targets.

## 9. Privacy and independent instances

The deployed product is static and performs every calculation on the client device.

It has:

- no backend;
- no account system;
- no database;
- no analytics or tracking;
- no cookies;
- no runtime API requests;
- no cross-tab synchronization;
- no storage-event listeners;
- no silent upload or persistence.

Each open tab owns an independent in-memory scenario. Tabs on the same device and instances on different machines cannot affect one another.

### 9.1 Remembered scenario

Remembering is off by default. The user must explicitly enable **Remember this scenario on this device**.

The app stores one versioned local snapshot. A later tab never applies it automatically; it only displays **Saved scenario available — Restore**. Restoring is an explicit action and copies the snapshot into that tab’s independent memory. Changes in any open tab do not update other tabs.

### 9.2 Sharing

Sharing remains explicit. A versioned URL fragment contains the calculator type and declared scenario fields. The UI warns that anyone with the URL can read those values. Unknown or malformed data is rejected atomically.

## 10. Component and code boundaries

The redesign uses focused React components without adding a router, state manager, UI framework, charting package, or font dependency.

Planned boundaries:

- `CalculatorShell`: calculator selection, solver navigation, privacy status, restore prompt, reset, and status messages;
- calculator modules: defaults, typed scenario, fields, validation, calculation adapter, and result labels;
- shared field components: number, date, select, mode toggle, disclosure, switch, and dynamic-entry rows;
- `ResultSummary`: common headline and calculator-specific secondary metrics;
- `PaymentGraph`: aggregation, series state, tooltips, range, selection, and schedule linking;
- `Schedule`: accessible yearly/monthly tabular view;
- shared serializers: calculator-aware share, remembered snapshot, CSV, XLSX, and print contracts.

Business calculations remain pure functions. UI components consume immutable typed results and do not reproduce financial formulas.

## 11. Error handling

- Every external boundary—share fragment and remembered snapshot—is parsed as `unknown` into declared typed fields.
- Wrong versions, malformed members, invalid enums, duplicate IDs, non-finite numbers, or excessive lists are rejected without partially applying state.
- Solver failures return field-keyed issues and plain-language recovery guidance.
- Export failures preserve the scenario and provide an accessible status message.
- Graph interaction never changes financial inputs or calculated schedules.
- Unsupported or impossible scenarios do not generate partial authoritative results.

## 12. Verification and acceptance criteria

### 12.1 Calculation

- Independent golden fixtures exist for every calculator and solver.
- Tests cover zero-rate, boundary-rate, maximum tenure/principal, rounding, flat/reducing comparison, balloon, resale horizon, APR, moratorium, capitalized interest, dated disbursements, prepayments, and rate changes.
- Deterministic randomized invariants reconcile principal, interest, fees, and balances.
- Home Loan and OD results remain identical to the approved audited engine for equivalent inputs.

### 12.2 State and privacy

- Two simultaneously open tabs can hold different scenarios without affecting each other.
- Remember is off by default.
- Enabling remember writes only the declared versioned snapshot.
- Another tab offers restore but does not auto-apply or live-sync.
- Reset supports undo and does not delete saved data.
- Delete saved scenario requires confirmation and removes the snapshot.
- No runtime request occurs during calculation, graph interaction, saving, restoring, sharing, or export.

### 12.3 Graph and UX

- Tooltip, legend, date range, yearly/monthly, OD comparison, graph-to-schedule, and schedule-to-graph interactions work with mouse, touch, and keyboard.
- Graph totals reconcile with the visible schedule and exported values.
- Text summaries and tables provide equivalent information.
- All invalid states correctly disable stale actions.
- No console/page errors occur in supported browser suites.

### 12.4 Responsive and accessibility

- Chromium, Firefox, WebKit, Pixel 5, and iPhone 13 emulation pass.
- 320×568, 375×812, 430×932, and 812×375 have no document overflow.
- Interactive targets meet the existing 44 px equivalent-target rule.
- Text and controls meet WCAG AA contrast.
- Focus order is logical and focus indicators remain visible.
- Reduced motion is honored.

### 12.5 Performance and deployment

- Existing calculation performance guards remain green.
- Initial JS and CSS gzip remain below the existing 85 kB budget unless an approved measured exception is documented.
- No new runtime dependency is added solely for layout, charts, routing, state, or fonts.
- Root and `/loan_emi_calculator/` GitHub Pages browser matrices pass.
- Production dependency audit reports zero known vulnerabilities.

## 13. Delivery strategy

Implementation will be ordered to keep the application usable after every phase:

1. establish shared suite types, navigation, privacy state, and visual tokens;
2. migrate Generic and Home into the common shell without changing financial outputs;
3. add shared solvers;
4. add Car and Personal specializations;
5. add Education phases and dated disbursements;
6. add the interactive graph and schedule linking;
7. complete calculator-aware sharing, remembering, export, print, and reset behavior;
8. run full visual, accessibility, performance, security, and GitHub Pages verification.

No production deployment or push is included unless separately requested.
