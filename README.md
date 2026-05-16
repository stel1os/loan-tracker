# Loan Tracker

A zero-install, browser-based loan tracker. Open the HTML file in any browser — no server, no setup, no dependencies.

## What it does

- Configure your loan once (balance, term, rate, start date)
- Set a monthly budget — see exactly when you'll be debt-free
- Make extra lump-sum payments against principal and watch the payoff date move
- Confirm actual payments as you go — locked rows are never overwritten
- Everything persists in your browser's `localStorage`

## How lump sums work

You set a monthly budget. The difference between your budget and your regular installment accumulates. Once a year — on a month you choose — the surplus is paid as a lump sum against the principal:

```
lump = ROUND(MAX(MIN(12 × budget − SUM(last 12 installments), balance), 0), 0)
```

After each lump sum the bank recalculates a lower installment for the remaining term.

## Usage

1. Download `loan-tracker.html`
2. Open it in any browser
3. Enter your loan details on first run
4. Set your monthly budget
5. Confirm payments as they happen

No account, no server, no data ever leaves your device.

## Files

| File | Description |
|---|---|
| `loan-tracker.html` | The entire app |
| `README.md` | This file |
