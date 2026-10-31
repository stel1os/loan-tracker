---
title: Loan Tracker — Requirements
created: 2026-05-17
updated: 2026-06-11
tags:
  - loan-tracker
  - requirements
---
# Loan Tracker — Requirements

Flat numbered list of functional requirements. Grouped by feature area. Derived from product decisions and open GitHub issues.

> [!note] Status key
> `done` — shipped | `pending` — not yet built | `deferred` — parked, no active sprint | `bug` — built but broken | `superseded` — replaced by another requirement

> [!note] Phase key
> `core` — single-loan HTML app | `multi-loan` — multiple loans support | `pwa` — offline/installable | `store` — Store distribution | `future` — speculative/not scheduled

---

## Loan Setup

| # | Requirement | Phase | Issue | Sprint | Status |
|---|-------------|-------|-------|--------|--------|
| FR-001 | User can input loan capital (principal) in euros on first run | core | | | done |
| FR-002 | User can input loan term in months or years | core | | | done |
| FR-003 | User can input annual nominal interest rate (%) | core | | | done |
| FR-004 | User can select rate type: Fixed or Variable | core | | | done |
| FR-005 | For Fixed rate: user inputs the fixed period duration in months | core | #3 | | done |
| FR-006 | User can input additional levies as a flat % on top of base rate | core | | | done |
| FR-007 | User can input loan start date | core | | | done |
| FR-008 | All loan setup values are stored in `localStorage` | core | | | done |
| FR-009 | All loan setup values are editable at any time via Settings | core | | | done |
| FR-010 | App presents a setup screen on first run (no hardcoded data) | core | | | done |
| FR-011 | Form field placeholders use round example amounts (not specific personal data) | core | | 3 | done |
| FR-012 | Entry screen does not include a "last known installments" seed field | core | | 3 | done |
| FR-013 | "Load example" button appears on both the first-run entry screen and the Edit screen; clicking it populates all fields with a sample loan (€200,000 principal, 360 months, 4.2% rate, 0.12% levy, fixed for 120 months, start Jan 2026, no annual lump sum, reduce-installment mode, target payoff Dec 2046, balloon threshold €5,000) but does not save — user must still click Save & Apply | core | | | done |

---

## Budget & Lump-Sum Payments

| # | Requirement | Phase | Issue | Sprint | Status |
|---|-------------|-------|-------|--------|--------|
| FR-020 | User can input a monthly budget | core | #8 | | done |
| FR-021 | User can input an annual budget; app converts to monthly automatically | core | #8 | | done |
| FR-022 | Monthly surplus = budget minus regular installment; accumulates each month | core | #8 | | done |
| FR-023 | User selects one or more months per year as annual lump-sum payment months | core | #16 | 2 | done |
| FR-023a | User can select multiple lump-sum months per year (e.g. Apr, Aug, Dec); accumulated surplus fires independently in each selected month; stored as `lumpMonths` array | core | #48 | 6 | done |
| FR-024 | Accumulated surplus up to the lump-sum month is paid as a lump sum against principal | core | #16 | 2 | done |
| FR-025 | Changing the budget recalculates the projection table live | core | | 2 | done |
| FR-026 | User can add a one-time manual lump-sum payment to any future row | core | #17 | 2 | done |
| FR-027 | Manual lump sums are independent of the annual lump-sum schedule | core | #17 | 2 | done |
| FR-028 | Annual lump sum is optional — user can disable it entirely via a toggle | core | | 3 | done |
| FR-029 | When annual lump sum is disabled, only regular installments are projected; no surplus accumulation | core | | 3 | done |
| FR-029a | Annual lump sum toggle defaults to **unchecked** on the new loan entry screen | core | #36 | | done |
| FR-024a | Annual lump sum uses the actual number of installments accumulated since loan start (capped at 12), not a hardcoded 12 — ensures correct first-lump for mid-year starts | core | #43 | 5 | done |

---

## Lump-Sum Effect Mode

| # | Requirement | Phase | Issue | Sprint | Status |
|---|-------------|-------|-------|--------|--------|
| FR-030 | User can choose how the bank recalculates after each lump sum: **Reduce duration** or **Reduce installment** | core | #9 | 3 | done |
| FR-031 | Reduce duration mode: installment stays roughly the same; loan ends earlier | core | #9 | 3 | done |
| FR-032 | Reduce installment mode: loan term stays fixed; monthly payment decreases after each lump sum | core | #9 | 3 | done |
| FR-032a | In Reduce Installment mode, the monthly instalment is recalculated every month from the current outstanding balance and remaining term — not only after lump-sum payments | core | #35 | | done |
| FR-033 | The selected mode applies globally to all lump sums | core | #9 | 3 | done |
| FR-034 | Switching mode recalculates the full projection table live | core | #9 | 3 | done |

---

## Final Payoff Planning

| #       | Requirement                                                                                                                                                                                           | Phase | Issue | Sprint | Status     |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- | ------ | ---------- |
| FR-040  | In Reduce installment mode: user can input a target payoff month; app calculates the lump sum required to clear the balance                                                                           | core  | #10   | 3      | done       |
| FR-041  | In Reduce installment mode: user can input a lump sum amount; app calculates the earliest possible payoff month                                                                                       | core  | #10   | 3      | done       |
| FR-042  | Final payoff planning results are shown without modifying the main projection                                                                                                                         | core  | #10   | 3      | done       |
| FR-046  | ~~Final Payoff Planning panel displays a subtitle or note clarifying it is a calculator only~~ — superseded by #33 (Apply button makes panel active)                                                  | core  | #33   |        | superseded |
| FR-043  | User can enable a balloon payment: a threshold balance at which the loan is paid off in full                                                                                                          | core  | #10   | 3      | done       |
| FR-044  | When balloon payment is enabled and a projected row's remaining balance ≤ threshold, a final payoff row is added paying the full remaining balance as a lump sum; loan ends there                     | core  | #10   | 3      | done       |
| FR-045  | Balloon payment row is visually distinct in the δοσολόγιο                                                                                                                                             | core  | #10   | 3      | done       |
| FR-044a | Balloon payoff row carries a separate `settlement` field for the remaining balance; `inst` reflects only the regular installment; any auto-lump in the same month is shown as a separate extra row immediately before the payoff row | core  | #44 #53 | 5 6 | done |

---

## Rate Change

| #      | Requirement                                                                                            | Phase | Issue | Sprint | Status |
| ------ | ------------------------------------------------------------------------------------------------------ | ----- | ----- | ------ | ------ |
| FR-050 | For Fixed rate loans: projection applies the fixed rate up to the end of the fixed period              | core  | #3    |        | done   |
| FR-051 | After the fixed period expires, the user can input a new rate; projection recalculates from that point | core  | #3    |        | done   |
| FR-052 | For Variable rate loans: user can edit the rate at any time; projection recalculates from that point   | core  | #3    |        | done   |

---

## Dashboard

| # | Requirement | Phase | Issue | Sprint | Status |
|---|-------------|-------|-------|--------|--------|
| FR-060 | Dashboard displays combined remaining balance | core | | | done |
| FR-061 | Dashboard displays projected payoff date with lump sums | core | | | done |
| FR-062 | Dashboard displays projected payoff date without lump sums (baseline) | core | | | done |
| FR-063 | Dashboard displays total interest saved vs no-extra-payments baseline | core | | | done |
| FR-063a | Interest-saved baseline uses the same two-phase rate schedule as the projection — prevents negative interest-saved values on fixed-rate loans where the post-fixed rate exceeds the fixed rate | core | #41 | 5 | done |
| FR-064 | Balance trajectory chart shows solid line for confirmed actuals | core | | | done |
| FR-065 | Balance trajectory chart shows dashed line for budget plan | core | | | done |
| FR-066 | Balance trajectory chart shows dotted line for baseline (no extras) | core | | | done |
| FR-067 | Balance trajectory chart marks scheduled lump-sum payments as dots | core | | | done |
| FR-068 | Balance trajectory chart shows a vertical marker at the fixed-rate end date (if applicable) | core | #19 | 4 | done |
| FR-069 | Balance trajectory chart shows a vertical marker at the target payoff date (if set) | core | #19 | 4 | done |

---

## Confirm Actuals

| # | Requirement | Phase | Issue | Sprint | Status |
|---|-------------|-------|-------|--------|--------|
| FR-070 | Each projected row has a Paid? checkbox | core | #21 | 2 | done |
| FR-071 | On confirm: fields are pre-filled with projected amounts; user edits if actual differs | core | #21 | 2 | done |
| FR-072 | Confirmed rows are locked (🔒) and never overwritten by recalculations | core | #21 | 2 | done |
| FR-073 | Locked rows can be unlocked and re-edited by the user | core | #21 | 2 | done |
| FR-074 | Progress bar width reflects actual principal reduced (from confirmed rows) as a percentage of the opening balance | core | #40 | 5 | done |
| FR-075 | 'So far' stats line shows principal reduced, interest paid, and extra lump payments derived from confirmed rows only | core | #40 | 5 | done |
| FR-076 | Principal field in the confirm-actual dialog is read-only and auto-derived as max(0, instalment − interest); user enters only interest and instalment | core | #42 | 5 | done |

---

## Data Management

| # | Requirement | Phase | Issue | Sprint | Status |
|---|-------------|-------|-------|--------|--------|
| FR-080 | User can export full app state (loan config + all confirmed rows + budget settings) as a JSON file | core | #18 | 4 | done |
| FR-081 | User can import a previously exported JSON file to restore full app state | core | #18 | 4 | done |
| FR-082 | Import replaces current state after user confirmation | core | #18 | 4 | done |

---

## Multi-Loan Support

| # | Requirement | Phase | Issue | Sprint | Status |
|---|-------------|-------|-------|--------|--------|
| FR-090 | User can add multiple loans (e.g. mortgage + home repair) | multi-loan | #56 | v1.6.0 | done |
| FR-091 | Dashboard aggregates balance and payoff across all loans | multi-loan | #56 | v1.6.0 | done |
| FR-092 | Each loan has its own projection tab | multi-loan | #56 | v1.6.0 | done |
| FR-093 | User can define a shared monthly budget split across loans | multi-loan | #56 | v1.6.0 | done |
| FR-094 | User can name / rename each loan (shown on tab + card) | multi-loan | #61 | v1.8.0 | done |

---

## Technical / Non-Functional

| # | Requirement | Phase | Issue | Sprint | Status |
|---|-------------|-------|-------|--------|--------|
| FR-100 | App is a single HTML file with no server and no build step | core | | | done |
| FR-101 | All state persists in `localStorage`; no data is sent externally | core | | | done |
| FR-102 | Chart.js loaded from CDN; no other runtime dependencies | core | | | done |
| FR-103 | User can select display locale (default: system locale) | core | | | deferred |
| FR-106 | Source is split into separate files (HTML, CSS, JS); a build script concatenates them into the distributable `loan-tracker.html` — GitHub Pages and release artifact continue to serve the single-file build | core | | | done |
| FR-107 | App displays a version number (e.g. in footer or header) sourced from the build | core | | | done |
| FR-104 | App works fully offline once loaded | pwa | #2 | | deferred |
| FR-105 | App is installable from the browser (PWA manifest + service worker) | pwa | #2 | | deferred |

---

## Present Value / Market Value Analysis

> **Context:** If a loan was originated at a rate lower than current market rates, the outstanding balance at face value overstates the lender's true asset value. The borrower is sitting on an unrealised gain equal to the difference between face value and the present value of remaining cash flows discounted at the current market rate. This section tracks features that expose this analysis to the user.

| # | Requirement | Phase | Issue | Sprint | Status |
|---|-------------|-------|-------|--------|--------|
| FR-130 | User can input a current market interest rate for comparison | future | | | deferred |
| FR-131 | App calculates the present value (PV) of remaining cash flows discounted at the current market rate: PV = Σ(instalment_t / (1 + market_rate/12)^t) | future | | | deferred |
| FR-132 | App displays the implied discount: outstanding principal − PV (positive = borrower gain; negative = borrower loss) | future | | | deferred |
| FR-133 | App displays the implied fair-value early settlement amount (= PV of remaining cash flows at market rate) alongside the contractual outstanding balance | future | | | deferred |

---

## Distribution

| # | Requirement | Phase | Issue | Sprint | Status |
|---|-------------|-------|-------|--------|--------|
| FR-110 | App published to Microsoft Store as a PWA | store | #4 | | deferred |
| FR-111 | App published to Google Play as a Trusted Web Activity (TWA) | store | #5 | | deferred |
| FR-112 | App has an onboarding flow for first-time users | store | | | deferred |

---

## In-App Help

| # | Requirement | Phase | Issue | Sprint | Status |
|---|-------------|-------|-------|--------|--------|
| FR-119 | USER-GUIDE.md includes a short version history section listing each release, its date, and key changes | core | | | done |
| FR-120 | App contains an in-app help/instructions section accessible without leaving the page | core | | | done |
| FR-121 | Help content covers: first-run setup, budget input, confirming payments, lump-sum modes, export/import | core | | | done |
| FR-122 | Help is accessible from the main UI (modal, collapsible panel, or dedicated tab — UX TBD) | core | | | done |
| FR-123 | All UI labels, help text, and instructions use correct financial terminology (e.g. principal, amortisation, instalment, interest, lump-sum prepayment) | core | | | done |
| FR-124 | Remaining "Bank" references in UI replaced with "lender"; levy field renamed to "Law 128/75 contribution (%)" with placeholder `0.12`; levy hint updated to "Law 128/75 contribution on top of base rate" | core | | | done |
| FR-125 | Column headers and inline notes use consistent British spelling "instalment" (not "installment") and "prepayment" (not "payment") throughout | core | | | done |
