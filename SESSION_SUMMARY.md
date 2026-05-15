# Cowork Session Summary

**Session ID:** `hopeful-epic-rubin`  
**Date:** 2026-05-15  
**Project folder:** `C:\Users\stkar\OneDrive\Documents\Claude\Projects\Personal Finance`

---

## What was built

A single-file personal loan tracker: **`loan-tracker.html`**

### Loans tracked
- **Alpha Mortgage** — €95,000 original, €88,314.11 balance as of Apr 2026, rate 4.52%/12 = 0.3767%/month
- **Alpha Repairs** — €20,000 in 2 tranches (Sep + Nov 2024), €18,619.01 balance as of May 2026, same rate

### Features implemented
1. **Transaction history tabs** (Mortgage, Repairs) — data from MMEX SQLite, weekend/weekday slip rows merged
2. **Projected payments table** per loan, starting from:
   - Mortgage: May 2026 (278 months remaining to Jul 2049)
   - Repairs: Jun 2026 (277 months remaining)
3. **Dynamic lump-sum formula** — replicates the Excel formula in `DANEIO.xlsx`:
   ```
   lump = ROUND(MAX(MIN(4 × budget − SUM(last 4 installments), remaining_balance), 0), 0)
   ```
   Lumps fire in **April, August, December** only. Budget input fields in each tab recalculate everything live and persist to `localStorage`.
4. **Budget defaults:** Mortgage €820/month, Repairs €180/month
5. **Confirm actuals** — checkbox per projected row opens editable fields; Save locks the row (🔒) permanently in `localStorage`
6. **Dashboard** — total debt card, payoff dates (computed dynamically), interest saved vs no-extras baseline, Chart.js balance trajectory
7. **Chart** — actual MMEX data (solid), budget plan (dashed), no-extras baseline (dotted), lump-sum dots; vertical line at Jul 2039 (fixed-rate end)

---

## Key constants (embedded in the HTML)

```javascript
MORT_BAL = 88314.11        // Apr 2026 closing balance
REP_BAL  = 18619.01        // May 2026 closing balance
RATE     = 0.003767        // 4.52% / 12
MORT_MONTHS = 278          // remaining months at May 2026
REP_MONTHS  = 277          // remaining months at Jun 2026

// Mortgage seed (last 4 installments before May 2026)
[523.73, 523.72, 519.90, 514.97]

// Repairs seed (last 4 installments before Jun 2026)
[111.26, 111.26, 109.80, 108.36]
```

---

## Files

| File | Purpose |
|---|---|
| `loan-tracker.html` | The entire app — open in any browser, no server needed |
| `README.md` | Full explanation of formula, chart, and confirm-actuals flow |
| `SESSION_SUMMARY.md` | This file |
| `DANEIO.xlsx` | Original Excel plan (reference) |

---

## How the file was built

The HTML file is ~33 KB. It was written via bash `cat >>` in 5 chunks to avoid the ~44 KB Write-tool truncation bug. To safely edit it in future sessions:

```bash
# Check current size
wc -c 'loan-tracker.html'

# Validate JS syntax (extract script block first)
node --check loan-tracker.html   # won't work on .html directly
# Instead: grep for key function names to verify integrity
grep -c 'genProj\|renderProj\|buildChart' loan-tracker.html
```

**Never use the Write or Edit tools directly on this file if it grows beyond ~44 KB — use bash `cat >>` chunks instead.**

---

## Known quirks

- `fmtE()` uses the literal `€` character (not `&#8364;`) because values are set via `textContent`, not `innerHTML`
- Greek locale (`el-GR`) is used throughout: thousands separator is `.`, decimal separator is `,`
- `R_HIST['2026-05']` is set to `REP_BAL` (18619.01) to anchor the chart plan line correctly — this is the opening balance for Jun 2026, not a closing balance
