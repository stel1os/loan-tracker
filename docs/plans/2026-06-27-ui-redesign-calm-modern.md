# Calm Modern UI Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the Loan Tracker UI to the approved "Calm Modern" design system and improve its information design, with no change to the calculation engine or data model.

**Architecture:** The app is a zero-install single-file build: `src/{index.html,style.css,engine.js,storage.js,ui.js}` are concatenated by `node build.js` into `loan-tracker.html`. This redesign touches only `src/index.html` (structure/labels), `src/style.css` (the visual system), `src/ui.js` (generated markup + collapsible behaviour), and a small persistence helper in `src/storage.js`. `src/engine.js` is **never** modified.

**Tech Stack:** Vanilla HTML/CSS/JS, Chart.js 4.5 (CDN, unchanged), Node `--test` engine regression suite.

## Global Constraints

- **Never edit `loan-tracker.html` directly** — it is a build artifact. Edit `src/`, then run `node build.js`.
- **Never modify `src/engine.js`.** The 12-test engine regression suite (`npm test`) must stay green and unchanged after every task.
- **No new features, no calculation changes.** Presentation and labelling only. Values already computed by the engine are re-labelled/re-laid-out, never recomputed.
- **Visual source of truth:** the committed spec `docs/specs/2026-06-27-ui-redesign-calm-modern-design.md` and the approved mockups in `.superpowers/brainstorm/1687-1782543460/content/` (notably `full-mockup-v7.html`, `confirm-control.html`, `chart-toggle.html`). Use them for exact colours, spacing, and layout.
- **Design tokens:** all colours/radii/shadows defined once as CSS custom properties (Task 1) and referenced via `var(--*)` thereafter. No hard-coded hex outside the token block (except inside Chart.js config and per-loan accent array).
- **Testing reality:** there is no DOM/visual test harness, and adding one is out of scope. Each task's "test cycle" is: `node build.js` succeeds → `npm test` green → an explicit **manual visual checklist** performed by opening `loan-tracker.html` with example data (load via the **Load example** button or import `samples/loan-tracker-2026-05-19.json`). Multi-loan checks: add a second loan via **+ Add loan** in the Edit modal.
- **Money semantics (spec §3):** **Outstanding** = `computeProgressStats(sched, loan.balance).latestBal` (current owed, the headline). **Borrowed** = `loan.balance` (context only). Never display the two as the same figure.
- **Commits:** branch `feat/64-calm-modern-redesign` (issue #64). Commit at the end of each task. Follow the SOP commit convention `<type>(#64): …` (the per-task example messages below use plain types — prefix each with `(#64)`). End every commit message with the Co-Authored-By trailer:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## File Structure

| File | Responsibility in this redesign |
|---|---|
| `src/style.css` | Token block; all component styling; split-pane + sticky layout; collapsible panel styles; table row-states. The bulk of the work. |
| `src/index.html` | Per-loan view wrapped into pinned + scrolling regions; chart and early-settlement wrapped in collapsible containers; summary cards relabelled (Outstanding/Borrowed); modal/help markup restyle hooks. |
| `src/ui.js` | `renderProj` (schedule markup); per-loan summary/metric population; interest comparison bars; dashboard renderers; `LOAN_COLORS`; collapsible toggle handlers; help/legend copy. |
| `src/storage.js` | One small pair of helpers to persist collapsible panel state. |
| `src/engine.js` | **Untouched.** |

---

## Task 1: Design tokens + base canvas & typography

**Files:**
- Modify: `src/style.css` (top of file — add `:root` token block; update `body`/base rules)

**Interfaces:**
- Produces: CSS custom properties consumed by every later task:
  `--bg #f5f6f8`, `--surface #fff`, `--ink #0f172a`, `--muted #94a3b8`,
  `--hairline #f1f5f9`, `--accent #4f46e5`, `--accent-soft #eef2ff`,
  `--positive #16a34a`, `--amber #b45309`, `--amber-soft #fef3c7`,
  `--payoff #7c3aed`, `--payoff-soft #f5f3ff`, `--radius-card 14px`,
  `--radius-ctl 9px`, `--shadow 0 1px 3px rgba(15,23,42,.06)`,
  `--font 'Inter',system-ui,-apple-system,sans-serif`.

- [ ] **Step 1: Add the token block** at the very top of `src/style.css`:

```css
:root{
  --bg:#f5f6f8; --surface:#fff; --ink:#0f172a; --muted:#94a3b8;
  --hairline:#f1f5f9; --accent:#4f46e5; --accent-soft:#eef2ff;
  --positive:#16a34a; --amber:#b45309; --amber-soft:#fef3c7;
  --payoff:#7c3aed; --payoff-soft:#f5f3ff;
  --radius-card:14px; --radius-ctl:9px;
  --shadow:0 1px 3px rgba(15,23,42,.06);
  --font:'Inter',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
}
```

- [ ] **Step 2: Update base rules** — set `body{font-family:var(--font);background:var(--bg);color:var(--ink);}` and the `<h1>`/`.subtitle` to the new ink/muted colours. Keep existing layout widths.

- [ ] **Step 3: Build & guard**

Run: `node build.js && npm test`
Expected: "Built loan-tracker.html" then 12 passing tests.

- [ ] **Step 4: Visual check** — open `loan-tracker.html`, Load example. Confirm: page background is the soft neutral, body font is Inter/system, no layout breakage. (Components still old-styled — that's expected.)

- [ ] **Step 5: Commit**

```bash
git add src/style.css loan-tracker.html
git commit -m "style: add Calm Modern design tokens and base canvas

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Per-loan summary chips — Outstanding/Borrowed relabel & wiring

**Files:**
- Modify: `src/index.html:46-50` (the `.summary-row` cards in `#loan-view`)
- Modify: `src/ui.js` (the per-loan summary population — locate where `card-total-debt`, `card-total-sub`, `card-payoff`, `card-saved` are set, inside `refreshLoan`)

**Interfaces:**
- Consumes: `computeProgressStats(sched, loan.balance).latestBal` (Outstanding), `loan.balance` (Borrowed), existing payoff month and interest-saved values already computed in `refreshLoan`.
- Produces: three restyled stat chips with ids preserved (`card-total-debt`→ now labelled "Outstanding", `card-payoff`, `card-saved`).

- [ ] **Step 1:** In `src/index.html`, change the first summary card label from `Total Debt` to `Outstanding`; keep `id="card-total-debt"` and `id="card-total-sub"`. Leave Plan Payoff and Interest Saved cards' ids intact; restyle classes only.

- [ ] **Step 2:** In `src/ui.js` `refreshLoan`, set the Outstanding chip's value from `latestBal` (current outstanding), not `loan.balance`. If it already uses `latestBal`, leave the value and only confirm the sub-line reads context (e.g. "of €<borrowed> borrowed"). Verify `loan.balance` is no longer surfaced as a standalone "debt" figure here.

- [ ] **Step 3:** In `src/style.css`, style `.summary-row` as a 3-col grid of `.card` chips: `var(--surface)`, `var(--radius-card)`, `var(--shadow)`, uppercase muted `.card-label`, tabular `.card-value`; Outstanding value in `--ink`, payoff in `--accent`, saved in `--positive`. Add `font-variant-numeric:tabular-nums` to `.card-value`.

- [ ] **Step 4: Build & guard** — `node build.js && npm test` → 12 pass.

- [ ] **Step 5: Visual check** — Load example. The first chip reads **Outstanding** with the *current* balance (matches the last locked row's balance in the schedule), not the opening balance. Three chips styled as Calm Modern cards.

- [ ] **Step 6: Commit**

```bash
git add src/index.html src/ui.js src/style.css loan-tracker.html
git commit -m "feat: per-loan summary shows Outstanding (current) not opening balance

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Loan card — hero progress, time-left, metric grid (Borrowed)

**Files:**
- Modify: `src/index.html:51-60` (`.loan-card` header, `.stat-grid`, `.progress-track`, `m-so-far-stats`)
- Modify: `src/ui.js` (`refreshLoan` population of `m-loan-title`, `m-badge`, `m-bal-stat`, `m-payoff`, `m-time-saved`, `m-next-lump`, `m-progress-fill`)

**Interfaces:**
- Consumes: `latestBal`, `loan.balance`, payoff month, time-saved, next-lump, progress percent — all already computed in `refreshLoan`.
- Produces: loan card with a **time-left** indicator, hero progress bar with start→payoff captions, and a 4-up metric grid **BORROWED · INT LEFT · NEXT LUMP · TIME SAVED**.

- [ ] **Step 1:** In `index.html`, restructure the loan card per `full-mockup-v7.html`: title row (accent dot + name + rate/term badge + right-aligned **time-left** span, new id `m-time-left`); progress bar; caption row (`m-so-far-stats` left = "€X paid of €Y borrowed", right = "<payoff> payoff"); metric grid with labels BORROWED / INT LEFT / NEXT LUMP / TIME SAVED — the BORROWED value cell id `m-borrowed`, INT LEFT id `m-int-left` (reuse plan-remaining-interest value), keep `m-next-lump`, `m-time-saved`.

- [ ] **Step 2:** In `ui.js` `refreshLoan`: populate `m-borrowed` = formatted `loan.balance`; `m-int-left` = plan remaining interest (already computed); `m-time-left` = months from current month to payoff formatted "Xy Ym left" (derive from existing payoff month and the projection's current month — no new engine call). Set progress-fill width and gradient to the accent.

- [ ] **Step 3:** In `style.css`, style `.loan-card`, `.loan-title`, `.badge`, `.stat-grid` (4-col, hairline top border), `.progress-track`/`.progress-fill` (rounded, indigo gradient), captions in `--muted`, time-left in `--ink`/`600`, TIME SAVED value in `--positive`.

- [ ] **Step 4: Build & guard** — `node build.js && npm test` → 12 pass.

- [ ] **Step 5: Visual check** — Load example. Card shows: time-left top-right (e.g. "1y 8m left"), hero progress with "paid of … borrowed" + payoff captions, 4 metrics each appearing once. **TIME SAVED** appears only in the grid; "ahead" wording is gone from the bar.

- [ ] **Step 6: Commit**

```bash
git add src/index.html src/ui.js src/style.css loan-tracker.html
git commit -m "feat: redesign loan card with hero progress, time-left, Borrowed metric

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Interest comparison bars (replace plan-box text)

**Files:**
- Modify: `src/index.html:61-66` (`.plan-box` block)
- Modify: `src/ui.js` (`refreshLoan` population of `m-plan-int`, `m-base-int`, `m-int-saved`, `m-lumps-total`)

**Interfaces:**
- Consumes: plan remaining interest, no-extras interest, interest saved, future lumps total — already computed.
- Produces: a two-bar comparison (No-extras vs Your plan) with the saved delta; same value ids retained for population.

- [ ] **Step 1:** In `index.html`, replace the four `.plan-row` text rows with the comparison-bar markup from `full-mockup-v7.html` / `dashboard-redesign.html`: a label "INTEREST: PLAN vs NO EXTRAS", a "No extras" bar (full width, muted) carrying `id="m-base-int"`, a "Your plan" bar (accent, width relative to no-extras) carrying `id="m-plan-int"`, a right-aligned "You save €… in interest" line `id="m-int-saved"`. Keep `m-lumps-total` as a small caption beneath.

- [ ] **Step 2:** In `ui.js`, set the two bar amounts and the saved line; compute the plan bar's width as `planInt/baseInt*100`% (display-only ratio, not an engine change). No new calculations beyond this ratio.

- [ ] **Step 3:** In `style.css`, style `.cmp-bar` track/fill, value chips, and the saved line (`--positive`).

- [ ] **Step 4: Build & guard** — `node build.js && npm test` → 12 pass.

- [ ] **Step 5: Visual check** — Load example. The interest section is two bars; "Your plan" is visibly shorter than "No extras"; saved figure matches the Outstanding-chip's interest-saved.

- [ ] **Step 6: Commit**

```bash
git add src/index.html src/ui.js src/style.css loan-tracker.html
git commit -m "feat: interest plan-vs-baseline shown as comparison bars

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Payment schedule — tints, pills, tabular nums, empty-circle confirm control

**Files:**
- Modify: `src/ui.js` `renderProj` (lines ~768-813) and the `.txn-note` legend copy
- Modify: `src/style.css` (`.txn` table, row-state classes, pills, confirm control)
- Modify: `src/index.html:103-104` (legend/note text)

**Interfaces:**
- Consumes: existing per-row fields and handlers `unlockRow(loanIdx,idx)`, `addLump(loanIdx,idx,month)`, row flags `confirmed`/`autoLump`/`payoff`.
- Produces: restyled rows; **the confirm affordance changes from blue ✓ to an empty circle ○** but calls the SAME `unlockRow` handler.

- [ ] **Step 1:** In `renderProj`, change the projected-row `#`-column markup so the confirm control is an empty circle, preserving the handler:

```js
const numCol=locked
  ? `<td class="num-cell"><span class="lock-ic" title="Confirmed — click to edit" onclick="unlockRow(${loanIdx},${idx})">&#128274;</span> ${n}</td>`
  : `<td class="num-cell"><span class="confirm-dot" title="Mark as paid — confirm actual amounts" onclick="unlockRow(${loanIdx},${idx})"></span> <span class="num-n">${n}</span></td>`;
```

- [ ] **Step 2:** In `style.css`, add `.confirm-dot{width:16px;height:16px;border:1.5px solid #cbd5e1;border-radius:99px;display:inline-block;cursor:pointer}` with `:hover{border-color:var(--accent)}`; keep `.lock-ic` clickable. Style `.txn` with tabular nums, hairline row separators, quiet `.tr-sep` year rows; row-state tints `.tr-confirmed` (faint green), `.tr-lump` (`--amber-soft`), `.tr-payoff` (`--payoff-soft`); interest cell colour → `--muted`; principal → `--ink`; lump pills `.lump-add`/`.lump-set` (indigo) and auto-lump amber pill; `+` affordance dashed.

- [ ] **Step 3:** Update the legend in `index.html` `.txn-note` (and any `ui.js` copy) to: "○ pending — click to confirm · 🔒 confirmed — click to edit · pill = scheduled/manual lump".

- [ ] **Step 4: Build & guard** — `node build.js && npm test` → 12 pass.

- [ ] **Step 5: Visual check (interaction)** — Load example. Projected rows show an empty ○ left of the number; locked rows show 🔒. **Click a ○** → inline editor opens (interest/instalment/lump + Save/Cancel); **Save** → row becomes locked with 🔒 and a green tint. Lump pills render (indigo manual, amber auto); payoff row violet; numbers right-aligned and column-aligned.

- [ ] **Step 6: Commit**

```bash
git add src/ui.js src/style.css src/index.html loan-tracker.html
git commit -m "feat: schedule restyle with empty-circle pending confirm control

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Collapsible chart & early-settlement panels (folded by default, persisted)

**Files:**
- Modify: `src/index.html` (wrap `.chart-card` for `balanceChart` and `#payoff-panel` in collapsible containers with toggle headers)
- Modify: `src/storage.js` (add panel-state persistence helpers)
- Modify: `src/ui.js` (toggle handler; apply persisted state on load in `refreshLoan`/`initApp`)

**Interfaces:**
- Produces: `getPanelOpen(key)` → boolean (default `false` = folded), `setPanelOpen(key, bool)` in `storage.js`; `togglePanel(key, headerEl)` in `ui.js`. Keys: `'chart'`, `'settlement'`, `'dashChart'` (Task 9).

- [ ] **Step 1:** In `storage.js`, add:

```js
function getPanelOpen(key){ try{return localStorage.getItem('lt_panel_'+key)==='1';}catch(e){return false;} }
function setPanelOpen(key,open){ try{localStorage.setItem('lt_panel_'+key, open?'1':'0');}catch(e){} }
```

(Default when unset: `false` → folded.)

- [ ] **Step 2:** In `index.html`, wrap each panel:

```html
<div class="collapsible" id="panel-chart">
  <div class="collapsible-head" onclick="togglePanel('chart',this)">
    <span class="collapsible-title">Projection chart</span>
    <span class="collapsible-toggle">Show &#9660;</span>
  </div>
  <div class="collapsible-body" style="display:none"><!-- existing .chart-card / balanceChart stays here unchanged --></div>
</div>
```

Do the same around `#payoff-panel` with `togglePanel('settlement',this)` and title "Early Settlement". Keep the inner chart canvas and payoff-panel markup byte-for-byte (only wrapped).

- [ ] **Step 3:** In `ui.js`, add:

```js
function togglePanel(key,headEl){
  const body=headEl.nextElementSibling;
  const open=body.style.display==='none';
  body.style.display=open?'':'none';
  headEl.querySelector('.collapsible-toggle').innerHTML=open?'Hide &#9650;':'Show &#9660;';
  setPanelOpen(key,open);
  if(open&&key==='chart')rebuildChart(); // ensure Chart.js sizes correctly when revealed
}
```

On load (end of `refreshLoan`), apply persisted state: if `getPanelOpen('chart')` open the chart panel (and `rebuildChart()`), same for `'settlement'`.

- [ ] **Step 4:** In `style.css`, style `.collapsible` (card), `.collapsible-head` (flex, pointer), `.collapsible-title` (`--ink` 700), `.collapsible-toggle` (`--accent` 600).

- [ ] **Step 5: Build & guard** — `node build.js && npm test` → 12 pass.

- [ ] **Step 6: Visual check (interaction + persistence)** — Load example. Both panels start **folded**. Click "Projection chart → Show" → chart expands and renders correctly (not zero-height). Click "Early Settlement → Show" → calculator expands and still works (select month → required lump). **Reload the page** → previously-opened panels remain open; folded ones stay folded.

- [ ] **Step 7: Commit**

```bash
git add src/index.html src/storage.js src/ui.js src/style.css loan-tracker.html
git commit -m "feat: collapsible chart and early-settlement panels with persisted state

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Split-pane per-loan layout (pinned summary, scrolling schedule)

**Files:**
- Modify: `src/index.html` (wrap `#loan-view` content into a pinned region and a scroll region around `.txn-section`)
- Modify: `src/style.css` (flex-column fixed-height layout; sticky schedule header; min-height fallback)

**Interfaces:**
- Consumes: all per-loan markup from Tasks 2–6.
- Produces: `#loan-view` as `display:flex;flex-direction:column;height:100vh` (within app max-width), with `.loan-pinned` (flex-shrink:0) and `.loan-scroll` (flex:1;overflow-y:auto).

- [ ] **Step 1:** In `index.html`, group everything in `#loan-view` **above** `.txn-section` into `<div class="loan-pinned">…</div>`, and wrap `.txn-section` (+ footer lines) into `<div class="loan-scroll">…</div>`. Keep all ids unchanged.

- [ ] **Step 2:** In `style.css`:

```css
#loan-view{display:flex;flex-direction:column;height:100vh;max-height:100vh}
.loan-pinned{flex-shrink:0;overflow:hidden}
.loan-scroll{flex:1;overflow-y:auto;min-height:0}
.txn-section .txn-title,
.txn-section .budget-bar{position:sticky;top:0;background:var(--bg);z-index:2}
.txn thead th{position:sticky;top:0;background:var(--surface);z-index:1}
@media (max-height:680px){
  #loan-view{height:auto;max-height:none}
  .loan-pinned{overflow:visible}
  .loan-scroll{overflow:visible}
}
```

(Tune sticky offsets so the table header sits below the budget bar; adjust `top` values to the measured heights.)

- [ ] **Step 3: Build & guard** — `node build.js && npm test` → 12 pass.

- [ ] **Step 4: Visual check** — Load example. Header/tabs/stats/loan-card/collapsibles stay fixed; only the Payment Schedule scrolls, and it occupies the majority of the window. Column headers stick while scrolling. Shrink the window very short → layout falls back to normal full-page scroll (nothing crushed).

- [ ] **Step 5: Commit**

```bash
git add src/index.html src/style.css loan-tracker.html
git commit -m "feat: split-pane per-loan layout — pinned summary, scrolling schedule

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Tab bar restyle

**Files:**
- Modify: `src/ui.js` `renderTabBar` (line ~401) and `style.css`

**Interfaces:**
- Consumes: existing tab data + `showTab` handler.
- Produces: segmented pill tab bar; same behaviour.

- [ ] **Step 1:** In `style.css`, style `#tab-bar` as a segmented control: `--bg`-darker track (`#eceef2`), active tab = white pill + `--shadow` + accent text; inactive = muted; "+ Add" affordance subtle. Per-loan tabs may carry the loan accent (from `LOAN_COLORS`, Task 9) as a small dot/underline.

- [ ] **Step 2:** Adjust `renderTabBar` markup/classes only if needed to support the pill styling (e.g. wrap labels in spans). Keep `showTab`, add, and delete wiring intact.

- [ ] **Step 3: Build & guard** — `node build.js && npm test` → 12 pass.

- [ ] **Step 4: Visual check (multi-loan)** — Add a second loan. Tab bar renders as pills; active tab highlighted; Dashboard tab appears; switching tabs works.

- [ ] **Step 5: Commit**

```bash
git add src/ui.js src/style.css loan-tracker.html
git commit -m "style: segmented pill tab bar

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 9: Multi-loan Dashboard restyle

**Files:**
- Modify: `src/ui.js` — `LOAN_COLORS` (line ~394), `renderDashboardStats`, `renderDashboardNextMonth`, `renderDashboardLoanCards`, `renderDashboardBudget`, `renderDashboardChart`, `toggleAnnualSchedule`/`renderAnnualSchedule`
- Modify: `src/index.html:31-44` (`#dashboard-view` scaffolding, wrap `dashboardChart` in a collapsible)
- Modify: `src/style.css`

**Interfaces:**
- Consumes: `computeAllLoansData()`, `computeProgressStats(...).latestBal`, `getPanelOpen/setPanelOpen/togglePanel` (Task 6).
- Produces: restyled aggregate view; per-loan accents from new `LOAN_COLORS`.

- [ ] **Step 1:** Update `LOAN_COLORS = ['#4f46e5','#0d9488','#d97706']` (indigo/teal/amber, harmonised with the palette).

- [ ] **Step 2:** `renderDashboardStats` — restyle the three aggregate cards as Calm Modern chips (Total Outstanding = `sum(latestBal)` — already correct; Total Interest Saved; Earliest Payoff). Tabular nums.

- [ ] **Step 3:** `renderDashboardLoanCards` — each card: loan name in its accent, **per-loan Outstanding** (`latestBal`), payoff month, accent progress bar; keep `onclick="showTab(...)"`. Restyle to surface/radius/shadow with accent top-border.

- [ ] **Step 4:** Wrap `dashboardChart`'s `.chart-card` in a collapsible (`togglePanel('dashChart',…)`, default folded, persisted) as in Task 6; call `renderDashboardChart`/rebuild when revealed.

- [ ] **Step 5:** `renderDashboardBudget` — restyle total input, per-loan sliders (`accent-color` = loan colour), %/€ cells, and the "sum to 100%" warning. Behaviour unchanged.

- [ ] **Step 6:** `renderAnnualSchedule` — apply the same table treatment as Task 5 (tints, tabular nums, pills); keep the annual toggle.

- [ ] **Step 7: Build & guard** — `node build.js && npm test` → 12 pass (note `redistributeBudgetAlloc` tests still green).

- [ ] **Step 8: Visual check (multi-loan)** — With two loans: Dashboard chips styled; each loan card shows its **own current outstanding** (not opening balance) in its accent; combined chart collapsible (folded default, remembers); budget sliders in loan colours and still redistribute to 100%; annual schedule matches the new table style.

- [ ] **Step 9: Commit**

```bash
git add src/ui.js src/index.html src/style.css loan-tracker.html
git commit -m "feat: restyle multi-loan Dashboard with Calm Modern + loan accents

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 10: Modals, help, first-run, footer restyle

**Files:**
- Modify: `src/style.css` (modal, form, help, banner, footer rules)
- Modify: `src/index.html` (Help "Confirming actual payments" copy → empty-circle ○)

**Interfaces:**
- Consumes: existing modal markup/handlers (unchanged).
- Produces: restyled Setup/Edit + Help modals; updated help copy.

- [ ] **Step 1:** In `style.css`, restyle `.modal-overlay`/`.modal`, `.form-section-title`, `.form-input`/`.form-select`/`.form-label`/`.form-hint`/`.form-err`, `.form-advanced-toggle`, and the action buttons (`.btn-primary` = accent, `.btn-secondary`, `.btn-danger`, `.btn-link-reset`) to Calm Modern. No field/logic changes.

- [ ] **Step 2:** In `index.html` Help modal, update the "Confirming actual payments" paragraph (line ~128-129) to describe clicking the **empty circle ○** on a projected row (instead of a "Paid?" checkbox), which opens the editor and locks the row to 🔒.

- [ ] **Step 3:** Restyle `.first-run-banner`, `.footer`, version/reset/coffee lines.

- [ ] **Step 4: Build & guard** — `node build.js && npm test` → 12 pass.

- [ ] **Step 5: Visual check** — Open **Edit** → form is Calm Modern, all fields present, Save & Apply works; advanced toggle works. Open **Help** → restyled; the confirm-payment section mentions the ○ control. First-run banner (clear data to see it) restyled.

- [ ] **Step 6: Commit**

```bash
git add src/index.html src/style.css loan-tracker.html
git commit -m "style: restyle modals, help, first-run and footer; update help for circle control

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 11: Chart palette alignment + full sweep + version bump

**Files:**
- Modify: `src/ui.js` (`buildChart`/`makeMarkersPlugin`/`renderDashboardChart` line/dataset colours)
- Modify: `package.json` (version bump)

**Interfaces:**
- Consumes: everything above.
- Produces: chart series coloured to palette; release version.

- [ ] **Step 1:** In `ui.js` chart config, set plan line = `--accent` indigo solid, no-extras baseline = muted dashed (`#cbd5e1`), lump markers = amber (`#d97706`). Behaviour/markers logic unchanged — colours only. For the dashboard combined chart, use the per-loan `LOAN_COLORS`.

- [ ] **Step 2:** Bump `package.json` version (e.g. `1.8.1` → `1.9.0`) so the footer reflects the redesign.

- [ ] **Step 3: Build & guard** — `node build.js && npm test` → 12 pass. Confirm footer shows the new version.

- [ ] **Step 4: Full visual sweep** — single-loan and multi-loan: every screen matches the approved `full-mockup-v7.html` intent; expand both charts and confirm colours; confirm no element still uses the old blue/green/amber palette inconsistently. Run through the confirm-row flow once more end to end.

- [ ] **Step 5: Commit**

```bash
git add src/ui.js package.json loan-tracker.html
git commit -m "feat: align chart palette to Calm Modern; bump version to 1.9.0

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review (author checklist — completed)

**Spec coverage:**
- Design system/tokens (spec §2) → Task 1. ✔
- Outstanding/Borrowed semantics (§3) → Tasks 2, 3, 9. ✔
- Split-pane per-loan layout (§4) → Task 7 (depends on Tasks 2–6). ✔
- Schedule information design + empty-circle control (§5) → Task 5. ✔
- Collapsible chart + early settlement, folded default, persisted (§6) → Task 6 (+ dashboard chart in Task 9). ✔
- Multi-loan Dashboard (§7) → Task 9; loan accents → Task 9 Step 1, used by Task 8. ✔
- Tab bar (§8) → Task 8. ✔
- Modals/help/first-run/footer (§8) → Task 10; help copy for ○ → Task 10 Step 2. ✔
- Responsive fallback (§8) → Task 7 Step 2 media query. ✔
- Chart palette alignment (§7) → Task 11. ✔
- Implementation approach / no engine changes / tests (§9) → Global Constraints + every task's build+guard step. ✔

**Placeholder scan:** No TBD/TODO; CSS fine-tuning is explicitly anchored to the committed mockups (legitimate visual source), with concrete tokens/structure/handlers given for all logic. ✔

**Type/name consistency:** `getPanelOpen`/`setPanelOpen`/`togglePanel` and keys `'chart'`/`'settlement'`/`'dashChart'` consistent across Tasks 6 and 9; `LOAN_COLORS` defined in Task 9 Step 1 and referenced by Tasks 8/9/11; existing handlers `unlockRow`/`addLump`/`showTab`/`rebuildChart` reused by exact name. ✔

**Note vs spec:** Spec §9 anticipated regression-snapshot updates; in reality the suite is engine-only and stays green unchanged (captured in Global Constraints). No scope change.
