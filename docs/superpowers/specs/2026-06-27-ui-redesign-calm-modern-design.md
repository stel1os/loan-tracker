---
title: Loan Tracker UI Redesign — "Calm Modern"
date: 2026-06-27
status: approved
type: design
scope: presentation only (no engine / calculation / data-model changes)
---

# Loan Tracker UI Redesign — "Calm Modern"

## 1. Goal & scope

Improve the **visual identity** and **information design** of the existing Loan
Tracker app. Same features, same calculation engine, same data model, same
interactions — restyled and re-laid-out so it reads clearly and looks
intentional instead of like a default dashboard.

**In scope**
- A coherent visual design system ("Calm Modern") applied across all screens.
- Information-design improvements to the per-loan view and the payment schedule.
- A new split-pane layout for the per-loan view (pinned summary, scrolling schedule).
- Collapsible **Projection chart** and **Early Settlement** panels.
- Multi-loan Dashboard, Setup modal, Annual schedule, Help modal, and tab bar
  re-skinned to the same system.

**Out of scope**
- Mobile / responsive rework (desktop-first; a graceful fallback only — see §8).
- Any new features.
- Any change to `src/engine.js`, `src/storage.js`, or the data shape.
- Changing what numbers are *calculated* (only how they are *labelled/derived for display*).

## 2. Design system — "Calm Modern"

Tokens (to be expressed as CSS custom properties in `src/style.css`):

| Token | Value | Use |
|---|---|---|
| `--bg` | `#f5f6f8` | app canvas |
| `--surface` | `#ffffff` | cards, panels, table |
| `--radius` | 14–16px | cards; 8–10px controls/pills |
| `--shadow` | `0 1px 3px rgba(15,23,42,.06)` | card elevation |
| `--hairline` | `#f1f5f9` | dividers, row separators |
| `--accent` | `#4f46e5` (indigo) | primary actions, plan figures, progress, active tab |
| `--accent-soft` | `#eef2ff` | accent backgrounds (pills, settlement panel) |
| `--positive` | `#16a34a` (green) | savings, time saved, "ahead" |
| `--muted` | `#94a3b8` | labels, interest (de-emphasised cost) |
| `--ink` | `#0f172a` | primary text / numbers |
| `--amber` | `#b45309` / bg `#fef3c7` | auto annual lump |
| `--payoff` | `#7c3aed` / bg `#f5f3ff` | payoff row/marker |
| font | Inter, system-ui fallback | all text |
| numerals | `font-variant-numeric: tabular-nums` | all money/figures |

**Loan accent colours (multi-loan):** replace the current `LOAN_COLORS`
(`#2563eb / #15803d / #d97706`) with a palette harmonised to Calm Modern while
staying mutually distinct — e.g. indigo `#4f46e5`, teal `#0d9488`, amber
`#d97706`. Used for per-loan tab accents, dashboard loan-card top borders,
budget sliders, and chart series.

**Reusable visual pieces:** stat chip, loan card, progress-bar-with-timeline,
4-up metric grid, comparison bars, pill (lump/badge), table row-states, soft
sub-panel, collapsible panel header, modal.

## 3. Money semantics (important — fixes a real labelling bug)

Two distinct figures must never be conflated:

- **Outstanding** = current amount still owed = `computeProgressStats(sched,
  balance).latestBal` (the balance after the last confirmed/locked row). This is
  the headline figure.
- **Borrowed / Opening balance** = `loan.balance` (the projection-start
  principal). Context only — shown in the progress caption ("€X paid of €Y
  borrowed") and as a `BORROWED` metric. Never shown as a standalone headline
  that looks like a duplicate of Outstanding.

Today the single-loan view labels the headline card "Total Debt" and the loan
card "Balance" and they can read as the same number. After the redesign:
- Headline stat → **OUTSTANDING** = `latestBal`.
- Loan-card metric grid → **BORROWED** = `loan.balance` (distinct, meaningful).
- The aggregate Dashboard headline "Total Outstanding" already uses
  `sum(latestBal)` and is correct — keep it.

No engine change: `latestBal` and `loan.balance` are both already computed.

## 4. Per-loan view (`#loan-view`) — split-pane layout

This is the largest structural change. The per-loan view becomes a fixed-height
two-region layout:

**Pinned region (does not scroll):**
1. App header — title, context subtitle, Export / Import / Edit / Help.
2. Tab bar (Dashboard / per-loan tabs / + Add).
3. Three summary stat chips: **OUTSTANDING**, **PAYOFF**, **SAVED**.
4. **Loan card** (condensed): name + rate/term badge + **time-left** indicator;
   hero progress bar with start→payoff captions ("€X paid of €Y borrowed" /
   "<month> payoff"); 4-up metric grid — **BORROWED · INT LEFT · NEXT LUMP ·
   TIME SAVED**.
5. Two collapsible panel headers side-by-side: **Projection chart** and **Early
   Settlement** (see §6).

**Scrolling region (takes the majority of the height):**
6. **Payment Schedule** — heading + monthly-budget control + table. The schedule
   heading and the table's column header **stick** to the top of the scroll
   region so columns stay visible while scrolling.

**Metric de-duplication:** "Time saved / ahead of schedule" appears exactly
once as the `TIME SAVED` metric; the on-bar indicator shows **time left**
(months to payoff), not "ahead". Interest-saved appears once in the `SAVED`
stat chip; the full plan-vs-no-extras comparison lives in the expanded chart/
settlement area, not duplicated in the pinned card.

**Interest breakdown:** the current `.plan-box` (four text rows: plan interest /
no-extras interest / saved / future lumps) is reworked into **comparison bars**
(No-extras vs Your plan) with the saved delta called out. It belongs in the
loan-card detail (full-width, below the metric grid) or the expanded area —
not the pinned summary if space is tight.

## 5. Payment schedule — information design

- All numeric columns right-aligned with `tabular-nums`.
- Row states by **soft tint + one marker**, not loud text colours:
  - confirmed/locked → faint green tint + 🔒 (click to edit/unlock)
  - auto annual lump → amber tint, lump shown as an amber pill
  - manual lump → indigo pill
  - payoff → violet tint, "Payoff" + €0 balance
- Principal stays `--ink`; **interest goes `--muted`** (de-emphasised cost).
- **Confirm/lock control (pending state):** each projected row shows an **empty
  circle ○** at the left of the `#` column = "not paid yet". Clicking it opens
  the existing inline editor (interest / instalment / lump → Save), after which
  the row locks and the ○ becomes 🔒. This preserves today's exact interaction
  (`unlockRow` → `confirmActual`); only the affordance changes from the blue ✓
  (which read as "done") to an empty circle (which reads as "to do").
- Editable future rows keep the dashed **+** in the Lump column (`addLump`).
- Quiet year-divider rows; hairline separators between rows.
- A small legend below the table: ○ pending · 🔒 confirmed · pill = lump.

## 6. Collapsible panels

Two panels in the per-loan view collapse to a single header bar with a
**Show ▼ / Hide ▲** toggle:

- **Projection chart** — wraps the **existing Chart.js chart unchanged** (same
  `balanceChart` canvas, data, markers, plugin). Only its container becomes
  collapsible. **Default: folded.** Open/closed state is **persisted** (localStorage,
  alongside existing prefs) and restored on load.
- **Early Settlement Calculator** — the existing `#payoff-panel` becomes
  collapsible with the same toggle pattern. Same contents and behaviour. Default
  folded; remember state (consistent with the chart).

Chart line colours align to the palette (plan = indigo solid, no-extras = muted
dashed, lumps = amber dots, markers unchanged in behaviour).

## 7. Multi-loan Dashboard (`#dashboard-view`)

The aggregate view is re-skinned to the same system (it is NOT the split-pane
layout — it has no long table):

- **Aggregate stat chips:** Total Outstanding (`sum(latestBal)`), Total Interest
  Saved, Earliest Payoff — restyled as Calm Modern stat cards.
- **Next-month due** line — restyled.
- **Combined balance chart** (`dashboardChart`) — wrapped in the same collapsible
  card pattern as the per-loan chart (default folded, remembered).
- **Per-loan cards** (`dash-loan-cards`) — each card: loan name (in its accent
  colour), **per-loan Outstanding** (`latestBal`), payoff month, and a progress
  bar in the loan's accent. Clicking a card switches to that loan's tab
  (unchanged behaviour).
- **Monthly budget allocation** (`dash-budget`) — total input + per-loan sliders
  + % + €, restyled (sliders use loan accent colours; the "must sum to 100%"
  warning restyled).
- **Annual schedule** (`dash-annual`) — collapsible, restyled to the same table
  treatment as the per-loan schedule.

Outstanding/Borrowed semantics (§3) apply at both per-loan and aggregate level.

## 8. Tab bar, modals, misc

- **Tab bar** — pill/segmented style: active tab = white pill on `#eceef2`
  track with accent text; per-loan tabs carry the loan accent; "+ Add" affordance
  restyled. Same `showTab` / add / delete behaviour.
- **Setup / Edit modal** — restyled to Calm Modern (inputs, labels, hints,
  section titles, errors, advanced toggle, action buttons). No field/logic
  changes. Note: the Opening Balance field's existing hint ("Outstanding balance
  as of the projection-start month — not the original loan amount") aligns with
  the §3 Borrowed/Outstanding model.
- **Help modal** — restyled; content unchanged except the "Confirming actual
  payments" paragraph is updated to describe the empty-circle ○ control instead
  of the "Paid?" checkbox / ✓.
- **First-run banner**, footer, reset/coffee/version lines — restyled.

**Responsive fallback (split-pane):** below a minimum viewport height the
per-loan view falls back to normal full-page scroll (no pinned region), so the
schedule is never crushed. This is the only responsiveness handled; full
mobile layout remains out of scope.

## 9. Implementation approach

- **Edit `src/` only**, then `node build.js` to regenerate `loan-tracker.html`.
  Never edit `loan-tracker.html` directly (build artifact).
- Files touched:
  - `src/style.css` — the bulk: tokens + all component styling, split-pane
    layout, sticky table header, collapsible panels, row states.
  - `src/index.html` — structural: wrap per-loan view in pinned + scroll
    regions; wrap chart and payoff-panel in collapsible containers; relabel
    summary cards (Outstanding/Borrowed); adjust static markup.
  - `src/ui.js` — generated-markup changes: `renderProj` (empty-circle control,
    pills, tints, tabular nums), the loan-view refresh (`refreshLoan` and the
    summary/metric population), interest comparison bars, dashboard renderers
    (`renderDashboardStats`, `renderDashboardLoanCards`, `renderDashboardBudget`),
    `LOAN_COLORS`, collapsible toggle handlers + localStorage persistence, and
    updating the schedule legend/help text.
- **No changes** to `src/engine.js` or `src/storage.js` logic (storage may gain
  one small key for the chart/settlement collapsed-state preference).
- **Tests:** `test/regression.js` snapshots the rendered output; markup changes
  will change snapshots. After implementation, run `npm run test:update`, then
  **manually verify every snapshot diff is purely presentational** (no changed
  numbers / computed values) before accepting. Functional engine tests must stay
  green unchanged.

## 10. Decisions locked during brainstorming

- Visual direction: **Calm Modern** (vs Warm Editorial / Dark Focused).
- Confirm control: **empty circle (pending)** (vs ✓, "Confirm" pill, open
  padlock, dotted ring).
- Chart: **kept as-is**, made collapsible, **folded by default, state remembered**.
- Early Settlement: **collapsible**.
- Layout: **pinned summary + independently scrolling Payment Schedule**, with the
  schedule given the majority of vertical space.
- On-bar indicator: **time left** (not "ahead"); time-saved shown once as a metric.
- **OUTSTANDING** (current) vs **BORROWED** (original) — never duplicated.

## 11. Open questions

None blocking. Minor items to settle during implementation:
- Exact min-height breakpoint for the split-pane → full-scroll fallback.
- Whether the interest comparison bars live always-visible in the loan card or
  inside the expanded chart/settlement area (space-dependent).
