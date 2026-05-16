# Loan Tracker — Claude CLI Context

Read **AGENTS.md** first. It has project context, agent roles, technical rules, and git workflow.

---

## Vault artifacts

Full spec and session history at:
`C:\Users\stkar\OneDrive\Documents\Obsidian Vault\artifacts\loan-tracker\`

Key files:
- `SPEC.md` — product spec, source of truth for WHAT to build
- `project.md` — one-page brief
- `handoff.md` — session handoff notes

---

## Sprint 1 — current work

Implement in this order:

| # | Issue | Status |
|---|-------|--------|
| 22 | Remove all MMEX references | Open — do first (prerequisite) |
| 15 | δοσολόγιο: unified payment schedule | Open — main feature |
| 20 | Reset button + rename Setup→Edit | Open — independent, small |

### #22 — MMEX cleanup
Strip all MMEX variable names, comments, hardcoded transaction arrays. No UI changes.

### #15 — δοσολόγιο
Replace transaction history + projected payments with a single unified schedule.
Columns: `# | Date | Principal | Interest | Installment | Lump Sum | Balance`
- ~240 rows, sticky headers, natural scroll
- Past rows: locked (🔒), unlockable by clicking
- Future rows: Lump Sum column has `+` icon for inline manual entry
- Auto lump-sum rows: highlighted
- Lump sum applied **before** installment of that month
- Balance from `lt_loans[0].balance` — no hardcoded values

### #20 — Reset + Edit rename
- Rename "Setup" → "Edit" everywhere (no logic change)
- `resetApp()`: clears all `lt_*` + `confirmed_*` localStorage keys, calls `openSetup(true)`
- Modal footer: Reset button (red, no confirm)
- Main view footer: Reset link (low-prominence, confirm dialog)

---

## Critical reminder

`loan-tracker.html` is >44 KB. **Never use Write or Edit on it.**
Always use `bash cat >>` in chunks. Check size first: `wc -c loan-tracker.html`
