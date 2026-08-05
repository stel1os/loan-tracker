---
title: Dashboard — x-axis labels, fixed-period markers, paid-to-date breakdown
date: 2026-08-05
status: approved
target: v1.10.0
---

# Dashboard: x-axis labels, fixed-period markers, paid-to-date breakdown

## Origin

User request (2026-08-05): *"at the dashboard add the vertical lines where the fixed period ends, an x axis, and a break down of principal paid per loan and interest paid already"*.

Investigation showed the three asks are not equivalent in nature:

| Ask | Status before this work |
|---|---|
| Vertical fixed-period lines | Feature. Already exists on the **per-loan** chart (`makeMarkersPlugin`, `src/ui.js:748`; wired in `buildChart`, `src/ui.js:775-787`). The dashboard chart never passes the plugin. |
| X axis | **Bug.** The dashboard chart already configures an x axis (`src/ui.js:616`); its labels render empty. See root cause below. |
| Principal / interest paid per loan | Feature. Data already computed — `computeProgressStats` returns `principalReduced`, `interestPaid`, `extrasSoFar` (`src/engine.js:121-129`), and `renderDashboardLoanCards` already calls it (`src/ui.js:523`) but uses only `latestBal` and `progressPct`. |

No engine change is required for any of the three. All work is in `src/ui.js` plus one `src/style.css` rule.

## Part 1 — X-axis labels (bug fix)

### Root cause

Both charts filter tick labels by calendar month:

```js
callback(v){ const l=this.getLabelForValue(v), d=new Date(l+'-01');
  return d.getMonth()%6===0 ? d.toLocaleDateString('en-GB',{month:'short'})+' '+d.getFullYear() : '' }
```

Only January (`getMonth()===0`) and July (`6`) produce text. But `maxTicksLimit:20` makes Chart.js auto-skip **before** the callback runs, keeping roughly every `ceil(N/20)`-th month. For a combined series of ~300 months the spacing is 15, and `15 mod 12 = 3`, so the kept ticks cycle through calendar months `start, start+3, start+6, start+9, start, …` — a 4-value cycle. Whether that cycle contains January or July depends entirely on the loan's start month:

- start = January → cycle {0,3,6,9} → hits both 0 and 6 → labels appear
- start = June → cycle {5,8,11,2} → hits neither → **every label is empty**

A compounding effect: empty-string labels measure zero width, so Chart.js's overlap detection never fires and never corrects the density.

This is a latent fault in the shared pattern. `renderDashboardChart` (`src/ui.js:616`) hits it more often because its label set is the union of all loans' months, hence longer; `buildChart` (`src/ui.js:793`) carries the identical filter.

### Fix

Label every tick Chart.js decides to keep; let `autoSkip` (now able to measure real widths) control density. Lower `maxTicksLimit` from 20 to 10 for readability at 10px type.

```js
ticks:{ maxTicksLimit:10, font:{size:10},
  callback(v){ const d=new Date(this.getLabelForValue(v)+'-01');
    return d.toLocaleDateString('en-GB',{month:'short'})+' '+d.getFullYear(); } }
```

Applied to **both** `renderDashboardChart` and `buildChart` — one fault, one fix. The per-loan chart is where the user first reported an invisible x axis (v1.9.1 fixed the clipping half of that report; this fixes the empty-label half).

## Part 2 — Fixed-period end markers on the combined chart

`renderDashboardChart` builds a markers array and passes the existing plugin:

- For each loan where `rateType==='fixed' && fixedPeriodMonths>0`, compute the end month with the same arithmetic as `buildChart:777-779` (`startMonth + fixedPeriodMonths`, rolling the year).
- Push `{month, color: LOAN_COLORS[i%LOAN_COLORS.length], label1: <loan label>, label2: '<Mon> <YYYY>', yOff}`.
- `label1` is the loan label truncated to 12 characters (ellipsis beyond), so long names don't run off the plot.
- Colour matches the loan's own series and dashboard card, so a line is attributable without a legend.
- Loans with no fixed period contribute no marker. If no loan has one, the markers array is empty and the chart renders exactly as before.
- `makeMarkersPlugin` already no-ops for a month outside the label range (`indexOf(m.month) < 0`), which covers a fixed period ending after payoff.

### `yOff` extension

`makeMarkersPlugin` currently draws `label1` at `ya.top+12` and `label2` at `ya.top+24`, hardcoded. Two loans whose fixed periods end in nearby months would overlap their labels. Add an optional `m.yOff||0` added to both y positions; the dashboard alternates `0` and `26` across successive markers by index.

Existing per-loan callers pass no `yOff`, evaluate to `0`, and are pixel-identical to today.

### Explicitly out of scope

The per-loan chart also draws a purple `Goal` marker for `targetPayoffDate`. It is **not** ported to the dashboard — not requested, and up to three more lines would crowd the plot.

## Part 3 — Paid-to-date breakdown on the loan cards

In `renderDashboardLoanCards`, `ps` (`computeProgressStats`) is already in scope. Add three lines per card:

```
Principal paid     €17.600
  of which lumps    €5.000
Interest paid       €9.240
```

- `Principal paid` = `ps.principalReduced` — i.e. `startBal - latestBal`, the whole balance reduction.
- `of which lumps` = `ps.extrasSoFar`, shown because principal reduction **includes lump-sum prepayments**. Without this line €17.600 reads as instalment principal when part of it was a one-off. Decision: show all three (user-approved) rather than fold lumps in silently or subtract them.
- `Interest paid` = `ps.interestPaid`.

The `of which lumps` line is **omitted** when `ps.extrasSoFar === 0` — a loan repaid purely by instalments shows two lines, not a `€0` filler. It appears as soon as any confirmed row carries a lump.

### Zero state

All three figures derive from **confirmed** rows only (`sched.filter(s=>s.confirmed)`). A user who has confirmed nothing gets zeros across the board. In that case render a single muted line — `Nothing confirmed yet` — instead of three €0 rows.

### Styling

One new rule in `src/style.css`: `.dash-loan-card-paid` — small type (~.72rem), muted label, tabular numerals to match the rest of the redesign, label left / figure right. The `of which lumps` line is indented and one step more muted. Amounts use the existing `fmtE()`.

## Testing

- `npm test` — engine regression must stay **12/12**. No engine file is touched; this is a guard, not a new assertion.
- No UI/DOM test harness exists in this project (per `AGENTS.md`), so Parts 1-3 are verified by human smoke check against `loan-tracker.html`.
- **Constraint:** the Claude Chrome extension is not connected in this session, so the agent cannot browser-verify. Visual confirmation is a human gate.

Smoke checklist:

1. Dashboard → expand **Combined balance chart** → x axis shows dated labels, evenly spread, none overlapping.
2. Same for a per-loan tab's **Projection chart** (regression check on the shared fix).
3. A loan with a fixed period shows a dashed line in its own colour, labelled with its name over the month; the line sits where the rate changes.
4. Two loans with fixed periods ending near each other → labels legible, not overprinted.
5. A loan with no fixed period contributes no line.
6. Loan cards show the three paid-to-date lines; figures match the loan's own schedule.
7. A loan with nothing confirmed shows `Nothing confirmed yet`.

## Build and release

Standard cycle: edit `src/` → `node build.js` → commit source and artifact together. Never edit `loan-tracker.html` directly.

Release as **v1.10.0** (feature). Direct-to-master, tag, GitHub release — the path used for v1.9.1. GitHub Pages (`build_type: legacy`, `source: {branch: master, path: /}`) redeploys from master root automatically, ~50s.

## Files touched

| File | Change |
|---|---|
| `src/ui.js` | `renderDashboardChart` — tick callback, markers array, plugin wiring; `buildChart` — tick callback; `makeMarkersPlugin` — `yOff`; `renderDashboardLoanCards` — three paid-to-date lines |
| `src/style.css` | `.dash-loan-card-paid` (+ indent/muted modifier) |
| `loan-tracker.html` | Rebuilt artifact |
| `package.json` | Version → 1.10.0 |
