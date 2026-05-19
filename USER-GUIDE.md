# Loan Tracker — User Guide

A zero-install, browser-based loan tracker. Download `loan-tracker.html`, open it in any browser, and you are running. No server, no account, no data leaves your device.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Getting Started](#2-getting-started)
3. [Dashboard](#3-dashboard)
4. [Payment Schedule](#4-payment-schedule)
5. [Monthly Budget](#5-monthly-budget)
6. [Lump-Sum Payments](#6-lump-sum-payments)
7. [Confirm Actuals](#7-confirm-actuals)
8. [Early Settlement Calculator](#8-early-settlement-calculator)
9. [Backup and Restore](#9-backup-and-restore)
10. [Settings and Reset](#10-settings-and-reset)
11. [Version History](#11-version-history)

---

## 1. Overview

Loan Tracker helps you understand and optimise your loan repayment. You enter your loan details once, set a monthly budget, and the app projects your full repayment schedule — showing exactly when you will be debt-free and how much interest you save by making extra payments.

**Key concepts:**

- **Budget** — the total amount you are willing to pay toward your loan each month (installment + any surplus)
- **Surplus** — the difference between your budget and your regular installment; it accumulates and is paid as a lump sum on your chosen annual month
- **Lump sum** — a one-off principal payment that reduces your balance directly, either shortening your loan term or lowering future installments
- **Confirmed actual** — a row you have locked after the payment has been made; locked rows are never overwritten by recalculations

---

## 2. Getting Started

### First run

Open `loan-tracker.html` in any browser. A setup form appears automatically.

Fill in your loan details:

| Field | Description |
|-------|-------------|
| **Loan balance** | Current outstanding principal (€) |
| **Term (months)** | Remaining term of the loan |
| **Annual interest rate** | Nominal annual rate (%) |
| **Levy (%)** | Any additional flat percentage levied by the bank (e.g. risk levy); enter 0 if none |
| **Rate type** | Fixed or Variable |
| **Fixed period (months)** | If Fixed: how many months until the rate resets |
| **Rate after fixed period** | The rate that applies after the fixed period ends |
| **Start month / year** | The month and year the loan began |
| **Annual lump-sum month** | The month each year when accumulated surplus is paid as a lump sum |
| **Lump sums enabled** | Toggle off to disable annual lump sums entirely |
| **Lump-sum effect** | How the bank recalculates after each lump sum (see [section 6](#6-lump-sum-payments)) |
| **Balloon threshold** | Optional: minimum lump-sum size below which the payment is skipped |
| **Goal payoff month / year** | Optional: draws a marker on the balance chart at your target payoff date |

Click **Save & Apply**. The app loads your projection immediately.

### Returning users

If you have a backup file from a previous session or another device, click **Import from backup** in the setup form footer instead of filling in the fields manually.

---

## 3. Dashboard

The dashboard gives you an at-a-glance summary of your loan.

### Summary cards (top row)

| Card | What it shows |
|------|---------------|
| **Total Debt** | Current outstanding balance |
| **Plan Payoff** | Projected payoff date based on your budget and lump-sum schedule |
| **Interest Saved vs No Extras** | Total interest you avoid by making extra payments compared to paying the minimum only |

### Loan card

Below the summary cards, the loan card shows:

| Stat | What it shows |
|------|---------------|
| **Balance** | Current balance |
| **Plan Payoff** | Payoff date with your current budget |
| **Time Saved** | How much earlier you pay off vs the original term |
| **Next Lump** | Amount and month of the next scheduled lump sum |

A progress bar indicates how far through the loan term you are.

Below that, two plan detail rows show projected total interest and the total of all future lump sums.

### Balance chart

The chart plots your loan balance over time using four visual elements:

| Element | Meaning |
|---------|---------|
| Solid line | Confirmed actual payments |
| Dashed line | Projected balance on your current budget plan |
| Dotted line | Baseline — no extra payments, minimum installment only |
| Dots on dashed line | Scheduled annual lump-sum payments |
| Vertical marker (orange) | End of fixed-rate period |
| Vertical marker (green) | Your goal payoff date (if set) |

---

## 4. Payment Schedule

The payment schedule (Δοσολόγιο) is the full month-by-month projection of your loan.

### Reading the table

Each row represents one month and shows:

| Column | Description |
|--------|-------------|
| **Month** | Month and year |
| **Balance** | Remaining principal after this payment |
| **Installment** | Regular monthly payment (principal + interest) |
| **Lump Sum** | Extra principal payment in this month (annual or manual) |
| **Total** | Installment + lump sum |
| **Paid?** | Checkbox to confirm this payment has been made |

### Row types

- **Standard row** — a regular projected month
- **Lump-sum row** — a month with a scheduled or manual extra payment (shown with the lump amount highlighted)
- **Balloon row** (purple) — a month containing a large payoff in Reduce Duration mode
- **Payoff row** — the final month when the balance reaches zero; shows the exact settlement amount

### Locked rows

Once you confirm a payment (see [section 7](#7-confirm-actuals)), the row is locked with a lock icon. Locked rows display the actual amounts you entered and are never changed by recalculations.

---

## 5. Monthly Budget

The **Monthly budget** field sits above the payment schedule.

Enter the total amount you can afford to pay each month. The budget drives everything:

- The surplus (budget minus installment) accumulates month by month
- On your chosen lump-sum month, accumulated surplus is paid against principal
- Increasing your budget grows the lump sum and brings your payoff date forward
- Decreasing it shrinks the lump sum or eliminates it entirely

Changes take effect immediately — the schedule and dashboard update live.

A note below the budget field shows the current monthly surplus or deficit.

---

## 6. Lump-Sum Payments

### Annual lump sum

Each year, on the month you selected in setup (e.g. August), the app calculates an automatic lump sum from your accumulated surplus:

```
lump = ROUND( MAX( MIN( 4 × budget − sum of last 4 installments, balance ), 0 ), 0 )
```

In plain terms: the lump sum is the surplus built up over roughly the last four months, capped at the remaining balance, and rounded to the nearest euro. If the result is zero or negative, no lump sum is scheduled that year.

You can change the annual lump-sum month at any time via **Edit** in the header.

### Manual lump sums

You can add a one-off extra payment to any future month in the schedule. Each projected row has an **Add lump** button. Click it, enter an amount, and confirm. The row updates immediately and the full projection recalculates.

To remove a manual lump sum, click the row again and set the amount to zero.

### Lump-sum effect modes

When you make a lump-sum payment, the bank recalculates your loan. You choose how:

**Reduce Duration**
The installment amount stays roughly the same. Each extra payment shortens the loan — you pay it off earlier. Use this if you want to be debt-free as soon as possible.

**Reduce Installment**
The term stays fixed. Each extra payment lowers your monthly installment going forward. Use this if you want to reduce your monthly outgoings while keeping the end date the same.

The mode is set in the loan setup form and applies to all lump sums. It can be changed at any time via **Edit**.

### Balloon threshold

If you set a balloon threshold (e.g. €500), the app will skip any lump sum smaller than that amount and carry the surplus forward to the next lump-sum month. This prevents small, administratively awkward payments.

---

## 7. Confirm Actuals

When a payment has been made, confirm it to lock that row.

1. Find the row for the month just paid
2. Tick the **Paid?** checkbox
3. A confirmation dialog appears, pre-filled with the projected installment and lump sum for that month
4. Edit the amounts if the actuals differ from the projection (e.g. the bank charged slightly differently)
5. Click **Save**

The row is now locked with a lock icon. Its values are your real figures and will never be overwritten, even if you change your budget, rate, or any other setting. All future rows recalculate from the locked balance.

To correct a locked row, click the lock icon to unlock and re-enter the amounts.

---

## 8. Early Settlement Calculator

Available only when the lump-sum effect mode is set to **Reduce Installment**.

The calculator helps you plan a one-time full or partial payoff — for example, if you expect a bonus, asset sale, or savings milestone.

Access it from the loan card on the dashboard.

### Target month → required lump sum

Select a month from the dropdown. The app calculates the exact lump sum you would need to pay in that month to clear the remaining balance entirely.

Click **Apply** to insert that lump sum into the payment schedule.

### Amount → earliest payoff month

Enter a lump sum amount. The app calculates the earliest month in which that payment would fully settle the loan.

Click **Apply** to insert it into the schedule.

---

## 9. Backup and Restore

### Export

Click **Export** in the top-right header. The app downloads a timestamped JSON file containing:

- Your full loan configuration
- All confirmed actual payments
- Your budget setting
- All manual lump sums

Keep this file as your backup. It can be restored on any browser or device.

### Import

Click **Import** in the top-right header (or **Import from backup** in the setup form on first run).

Select your previously exported JSON file. The app shows a summary of the loan it found in the file and asks for confirmation before replacing your current data.

---

## 10. Settings and Reset

### Edit loan settings

Click the **Edit** button (gear icon) in the top-right header to reopen the loan setup form. All fields are editable. Changes take effect immediately after you click **Save & Apply**.

Locked (confirmed) rows are preserved across edits — only future projected rows recalculate.

### Reset all data

In the loan setup form (Edit), click **Reset all data** at the bottom left. This permanently deletes your loan configuration, all confirmed actuals, your budget, and all manual lump sums from the browser's local storage.

After reset, the app returns to the first-run state. You can set up a new loan or import a backup.

**This action cannot be undone. Export a backup first if you want to preserve your data.**

---

## Data and Privacy

All data is stored exclusively in your browser's `localStorage`. Nothing is sent to any server. The app works fully offline. Clearing your browser's storage or switching to a different browser will lose your data unless you have exported a backup.

---

## 11. Version History

| Version | Date | Changes |
|---------|------|---------|
| v1.1.2 | 2026-05-19 | Load example button added to Edit screen |
| v1.1.1 | 2026-05-19 | Fix help modal invisible background |
| v1.1.0 | 2026-05-19 | In-app help; load-example button on entry screen; version display in footer; reduce-instalment recalculation verified |
| v1.0.0 | 2026-05-17 | Public release: configurable loan setup, annual lump-sum schedule, manual prepayments, reduce-duration / reduce-instalment modes, early settlement calculator, balloon payment, confirm actuals, export / import, balance chart |
| v0.1 | 2026-05-01 | Initial working prototype |
