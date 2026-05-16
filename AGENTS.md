# AGENTS.md — Loan Tracker

This file is read by every agent at spawn. It contains project context, agent roles, and working rules.

---

## Project

Single-file HTML loan tracker. No server, no build step, no dependencies except Chart.js (CDN).
All state lives in `localStorage`. Open `loan-tracker.html` in any browser — that's it.

**Repo:** https://github.com/stel1os/loan-tracker (private)
**Spec:** `artifacts/loan-tracker/SPEC.md` in the Obsidian Vault
**Current version:** v0.1 — working prototype, personal data hardcoded, not yet published

---

## Agent Roles

### PM
- Runs at session start
- Reads `SPEC.md` + open GitHub issues (`gh issue list --state open`)
- Proposes build order for the session
- Flags any conflicts between issues and spec
- Does NOT write code

### Builder
- Receives a build plan from PM (or user)
- Implements one issue at a time
- Works in a git worktree (isolated branch) — never commits directly to main
- Reads AGENTS.md + relevant spec section before starting
- Opens a PR when done, does not merge

### Reviewer
- Reads the Builder's PR diff
- Checks implementation against the spec section for that issue
- Has NOT seen the Builder's reasoning — gives independent judgment
- Returns: approve / request changes (with specific notes)
- Does NOT write code

### Tester
- Opens `loan-tracker.html` in a browser context (or validates via static analysis)
- Follows a test checklist derived from the issue being tested
- Reports pass/fail per checklist item
- Does NOT write code

---

## Critical Technical Notes

### File size limit
The HTML file is ~33 KB. The Write tool truncates at ~44 KB.
**If the file grows beyond ~40 KB, use bash `cat >>` in chunks — never the Write or Edit tool directly.**
Check size before editing: `wc -c loan-tracker.html`

### localStorage keys
- `loanBudget` — mortgage monthly budget
- `repairBudget` — repairs monthly budget
- `confirmed_mort_*` — confirmed actual rows, mortgage
- `confirmed_rep_*` — confirmed actual rows, repairs

These will be refactored in v1.0 when loan setup becomes user-configurable.

### Formatting quirks
- `fmtE()` uses the literal `€` character via `textContent`, not `innerHTML` — do not change to `&#8364;`.
  This rule applies to `fmtE()` / `textContent` assignments only.
  HTML entities **do not render on `<canvas>`**, so Chart.js callbacks (e.g. Y-axis tick formatter)
  must use the literal `'€'` character — that is correct and intentional, not a violation of this rule.
- Greek locale (`el-GR`) throughout: thousands separator `.`, decimal `,`
- This will become user-selectable in v1.0

### Key constants (v0.1, hardcoded)
```
MORT_BAL    = 88314.11   // Apr 2026 closing balance
REP_BAL     = 18619.01   // May 2026 closing balance
RATE        = 0.003767   // 4.52% / 12
MORT_MONTHS = 278        // remaining at May 2026
REP_MONTHS  = 277        // remaining at Jun 2026

Mortgage seed: [523.73, 523.72, 519.90, 514.97]
Repairs seed:  [111.26, 111.26, 109.80, 108.36]
```

### Lump-sum formula
```
lump = ROUND(MAX(MIN(4 × budget − SUM(last 4 installments), balance), 0), 0)
```
Fires in April, August, December only (v0.1). User-configurable in v1.0.

---

## Git Workflow

- `main` — stable, always working
- Feature branches: `feat/<issue-number>-<short-description>`
- Builder opens PR → Reviewer approves → user merges
- Commit messages: `#<issue> short description`

---

## Build Order (v1.0 priority)

1. #7 — Loan setup (configurable parameters) — **blocker**
2. #1 — Remove hardcoded data, wire to loan setup
3. #8 — Budget input + flexible lump-sum month
4. #9 — Lump-sum effect mode (duration vs installment)
5. #10 — Final payoff planning
6. #2 — Generalize README
7. #3 — PWA packaging
