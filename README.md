# Loan Tracker

Personal mortgage & general loan tracker — powered by user data and a budget-driven lump-sum formula.

## What it does

`loan-tracker.html` is a single self-contained HTML file you open in any browser. It has three tabs:

- **Dashboard** — combined balance, interest saved vs no-extras baseline, plan payoff dates, and a Chart.js balance trajectory for both loans
- **Mortgage tab** — full transaction history + projected future payments driven by your monthly budget

No server, no install. All state (confirmed actuals, saved budgets) lives in the browser's `localStorage`.

---

## How the lump-sum formula works

This replicates the Excel formula in `DANEIO.xlsx`:

```
lump = ROUND(MAX(MIN(4 × budget − SUM(last 4 installments), remaining_balance), 0), 0)
```

In plain language:

1. Each month you budget a fixed amount (e.g. €820 for the mortgage).
2. Your regular installment is less than the budget, so the difference accumulates.
3. Three times a year — **April, August, December** — the accumulated surplus (up to 4 months' worth) is paid as a lump sum against the principal.
4. After the lump, the bank recalculates a new (lower) installment for the remaining term at the same fixed rate.

The "last 4 installments" window is seeded from actual MMEX data so the very first projected lump matches the Excel plan exactly.

### Seed values

| Loan | Seed installments (before first projection month) |
|---|---|
| Mortgage (from May 2026) | Jan €523.73, Feb €523.72, Mar €519.90, Apr €514.97 |
| Repairs (from Jun 2026) | Feb €111.26, Mar €111.26, Apr €109.80, May €108.36 |

### Changing the budget

Each projected table has a **Monthly budget** field at the top. Change it and press Tab/Enter — the entire projection and chart recalculate instantly. The value is saved in `localStorage` so it persists across sessions.

---

## Chart

The balance chart shows four things:

| Line | Meaning |
|---|---|
| Solid (blue / orange) | Actual MMEX balances |
| Dashed | Your budget plan trajectory |
| Dotted (faint) | Baseline — no extra payments ever |
| Dots | Scheduled lump-sum payments |

A purple dashed vertical line marks **Jul 2039** (fixed-rate period end).

---

## Confirming actual payments

In the Mortgage or Repairs tab, projected rows have a **Paid?** checkbox. When you tick it:

1. Input fields appear pre-filled with the projected amounts.
2. Edit if the bank charged something slightly different.
3. Click **Save** — the row is locked (🔒) and written to `localStorage`.
4. Confirmed rows are never overwritten by budget recalculations.

---

## Data source

All historical transactions are from **MMEX** (personal finance desktop app), exported manually and embedded in the HTML. The Greek locale (`el-GR`) is used for number formatting throughout.

---

## Files

| File | Description |
|---|---|
| `loan-tracker.html` | The entire app — open in browser |
| `DANEIO.xlsx` | Original Excel plan (reference only) |
| `README.md` | This file |
