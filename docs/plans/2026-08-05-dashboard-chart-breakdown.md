---
title: Dashboard x-axis, fixed-period markers, paid-to-date — implementation plan
date: 2026-08-05
spec: docs/specs/2026-08-05-dashboard-chart-breakdown-design.md
target: v1.10.0
---

# Dashboard Chart & Breakdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the dashboard's combined chart show its x-axis labels and each loan's fixed-period end, and show principal/interest paid to date on each dashboard loan card.

**Architecture:** Three independent changes, all in `src/ui.js` plus one `src/style.css` rule. No engine change — every figure displayed already exists in `computeProgressStats`, and the vertical-line renderer already exists as `makeMarkersPlugin`. The x-axis work is a bug fix to a tick callback shared verbatim by both charts.

**Tech Stack:** Vanilla JS, Chart.js 4.5.0 (CDN), Node 24 test runner. No framework, no bundler — `build.js` concatenates `src/` into `loan-tracker.html`.

## Global Constraints

- **Never edit `loan-tracker.html` by hand.** It is a build artifact (~107 KB, over the Edit tool limit). Edit `src/`, then run `node build.js`.
- **Never modify `src/engine.js`.** This work needs no engine change. If you think it does, stop and escalate.
- Run `node build.js` after every `src/` change; commit source and rebuilt artifact together.
- `npm test` must report **12/12 passing** before this plan starts and **13/13** after Task 3. It must never go red.
- Money is rendered with the existing helper `fmtE = n => '€'+Math.round(n).toLocaleString('el-GR')` (`src/ui.js:392`). Note it **rounds to whole euros** — `fmtE(6868.19)` is `€6.869`, with `.` as the Greek thousands separator. It returns a literal `€` character (never the `&#8364;` entity) and is safe to interpolate into the innerHTML strings these renderers build, which is how the cards already print balances. Chart.js canvas callbacks must likewise use the literal `'€'` — HTML entities do not render on `<canvas>`.
- Greek locale (`el-GR`) number formatting throughout; date labels use `en-GB`.
- Commit message prefixes: `feat:` / `fix:` / `test:` / `chore:` / `docs:`.
- Existing constants you will use, already defined in `src/ui.js`: `LOAN_COLORS = ['#4f46e5','#0d9488','#d97706']` (line 394), `MN = ['Jan',…,'Dec']` (line 390).

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `src/ui.js` | All DOM rendering, chart config, event handlers | Modify 4 regions — see per-task line refs |
| `src/style.css` | All CSS | Add `.dash-loan-card-paid` + `.dash-loan-card-paid.sub` |
| `test/regression.js` | Node test runner suite over the engine | Add 1 characterization test; extend the `require` line |
| `loan-tracker.html` | Build artifact | Rebuilt, never hand-edited |
| `package.json` | Version, stamped into the build | Bump to 1.10.0 in Task 4 only |

### Note on testability — read before starting

`src/ui.js` has **no `module.exports`** (verified: `grep -c "module.exports" src/ui.js` → 0), so the Node test runner cannot reach any UI function. Tasks 1 and 2 change Chart.js configuration and canvas drawing; there is **no automated assertion available for them in this project**, and no DOM/UI harness exists (see `AGENTS.md`). Do not invent one — adding jsdom or extracting `ui.js` into modules is out of scope for this plan.

For those tasks, `npm test` is a **regression guard only** (proves you didn't break the engine), and correctness is established by the manual browser checks written into each task. Perform them; do not skip and do not report a task complete without them.

Task 3 is different: the figures it displays come from `computeProgressStats`, which **is** exported and testable. That task gets a real test.

---

### Task 1: X-axis labels appear on both charts

**Files:**
- Modify: `src/ui.js` — two identical occurrences of the x-tick config, at line 616 (`renderDashboardChart`) and inside line 793 (`buildChart`)
- Test: none available (see "Note on testability" above)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: nothing later tasks depend on. Purely a config change.

**Background — why the labels are empty.** The callback returns text only when `d.getMonth()%6===0`, i.e. January or July. But `maxTicksLimit:20` makes Chart.js auto-skip *before* the callback runs, keeping about every `ceil(N/20)`-th month. For a ~300-month series that is every 15th month, and `15 mod 12 = 3`, so kept ticks cycle through calendar months `start, start+3, start+6, start+9, …` — four values. A June start yields {5,8,11,2}, which contains neither 0 nor 6, so **every** label is empty. Empty labels also measure zero width, so Chart.js's overlap detection never fires to correct it.

- [ ] **Step 1: Confirm both occurrences are byte-identical**

Run:
```bash
grep -c "maxTicksLimit:20,font:{size:10},callback(v){const l=this.getLabelForValue(v),d=new Date(l+'-01');return d.getMonth()%6===0" src/ui.js
```
Expected: `2`

If this prints anything other than `2`, stop — the file has drifted from this plan; re-read both sites before editing.

- [ ] **Step 2: Replace both tick configs with one `replace_all` edit**

Old string (appears exactly twice):
```js
maxTicksLimit:20,font:{size:10},callback(v){const l=this.getLabelForValue(v),d=new Date(l+'-01');return d.getMonth()%6===0?d.toLocaleDateString('en-GB',{month:'short'})+' '+d.getFullYear():''}
```

New string:
```js
maxTicksLimit:10,font:{size:10},callback(v){const d=new Date(this.getLabelForValue(v)+'-01');return d.toLocaleDateString('en-GB',{month:'short'})+' '+d.getFullYear()}
```

Use the Edit tool with `replace_all: true`. Two changes: every kept tick now gets a label, and the cap drops 20 → 10 so 10px labels have room.

- [ ] **Step 3: Verify exactly two replacements landed**

Run:
```bash
grep -c "getMonth()%6===0" src/ui.js && grep -c "maxTicksLimit:10" src/ui.js
```
Expected: first `0` (grep exits 1 when no match — that is the success case here), second `2`.

- [ ] **Step 4: Rebuild and run the engine guard**

Run:
```bash
node build.js && npm test
```
Expected: `Built loan-tracker.html (v1.9.1)` and `pass 12 / fail 0`. The version still reads 1.9.1 — the bump happens in Task 4.

- [ ] **Step 5: Manual browser check (required — do not skip)**

Open `loan-tracker.html`. If there is no saved data, click **Load example**.

1. On a loan tab, expand **Projection chart** → the x axis shows dated labels such as `Aug 2024`, evenly spaced, none overlapping or clipped.
2. If more than one loan exists, open **Dashboard** → expand **Combined balance chart** → same result.
3. Resize the window narrower → labels thin out rather than colliding (this is `autoSkip` working now that labels have real width).

Record the actual result. If labels still do not appear, **stop and report** — the hypothesis in the spec is wrong and the remaining tasks should not be built on it.

- [ ] **Step 6: Commit**

```bash
git add src/ui.js loan-tracker.html
git commit -m "fix: x-axis labels never rendered on either chart

The tick callback only returned text for January and July, but
maxTicksLimit:20 makes Chart.js auto-skip first, keeping roughly every
ceil(N/20)-th month. At 15-month spacing the kept ticks cycle through four
calendar months (15 mod 12 = 3); depending on the loan start month that
cycle can contain neither January nor July, emptying every label. Empty
labels also measure zero width, so overlap detection never corrected it.

Label every kept tick and let autoSkip control density; cap 20 -> 10.
Both charts shared the config verbatim, so both are fixed."
```

---

### Task 2: Fixed-period end markers on the combined chart

**Files:**
- Modify: `src/ui.js:748-764` (`makeMarkersPlugin` — add `yOff`)
- Modify: `src/ui.js:595-621` (`renderDashboardChart` — build markers, pass plugin)
- Test: none available (see "Note on testability")

**Interfaces:**
- Consumes: `LOAN_COLORS` (line 394), `MN` (line 390), `makeMarkersPlugin(markers)` (line 748), and the `data` array from `computeAllLoansData()` whose elements are `{loan, rows, sched, payoffMonth, intSaved, budget, nextUnconf, loanIdx}`.
- Produces: `makeMarkersPlugin` marker objects gain an optional `yOff` (number, default 0). Existing callers in `buildChart` pass no `yOff` and must stay pixel-identical.

- [ ] **Step 1: Add the optional `yOff` to the marker plugin**

In `src/ui.js`, replace these two lines inside `makeMarkersPlugin`:

```js
      ctx.fillText(m.label1,x,ya.top+12);
      if(m.label2)ctx.fillText(m.label2,x,ya.top+24);
```

with:

```js
      const yo=m.yOff||0;
      ctx.fillText(m.label1,x,ya.top+12+yo);
      if(m.label2)ctx.fillText(m.label2,x,ya.top+24+yo);
```

- [ ] **Step 2: Build the markers array in `renderDashboardChart`**

In `src/ui.js`, find this line in `renderDashboardChart`:

```js
  const ctx=document.getElementById('dashboardChart');
```

Insert immediately **above** it:

```js
  const markers=[];
  data.forEach((d,i)=>{
    const L=d.loan;
    if(L.rateType!=='fixed'||!(L.fixedPeriodMonths>0))return;
    let em=L.startMonth+L.fixedPeriodMonths,ey=L.startYear;
    while(em>12){em-=12;ey++;}
    const name=L.label||'Loan '+(i+1);
    markers.push({
      month:ey+'-'+String(em).padStart(2,'0'),
      color:LOAN_COLORS[i%LOAN_COLORS.length],
      label1:name.length>12?name.slice(0,11)+'…':name,
      label2:MN[em-1]+' '+ey,
      yOff:(markers.length%2)*26
    });
  });
```

Notes for the implementer:
- The month arithmetic is copied deliberately from `buildChart` (`src/ui.js:777-779`) so both charts place the line on the same month.
- `yOff` alternates `0, 26, 0, …` by how many markers are already queued, so two loans whose fixed periods end close together do not overprint their two-line labels.
- Loans without a fixed period push nothing. If no loan has one, `markers` stays empty and the plugin's `forEach` is a no-op.
- A fixed period ending after payoff needs no guard here: `makeMarkersPlugin` already returns early when `c.data.labels.indexOf(m.month) < 0`.

- [ ] **Step 3: Pass the plugin to the dashboard chart**

In the same function, change:

```js
  dashboardChart=new Chart(ctx.getContext('2d'),{type:'line',data:{labels,datasets},
```

to:

```js
  dashboardChart=new Chart(ctx.getContext('2d'),{type:'line',plugins:[makeMarkersPlugin(markers)],data:{labels,datasets},
```

- [ ] **Step 4: Rebuild and run the engine guard**

Run:
```bash
node build.js && npm test
```
Expected: build succeeds, `pass 12 / fail 0`.

- [ ] **Step 5: Manual browser check (required — do not skip)**

Needs at least two loans; add a second via **+ Add** in the tab bar if necessary, giving it a fixed rate type and a fixed period.

1. Dashboard → expand **Combined balance chart**. Each fixed-rate loan shows one dashed vertical line in **its own colour** (loan 1 indigo `#4f46e5`, loan 2 teal `#0d9488`, loan 3 amber `#d97706`) — the same colour as its line series and its card's top border.
2. Each line is labelled with the loan name over the month, e.g. `Mortgage` / `Jul 2039`.
3. Cross-check one line against the loan's own tab: its **Projection chart** draws the orange `Rate end` marker on the same month.
4. Two loans whose fixed periods end within a few months of each other → the second label block sits lower, both readable.
5. A loan with `rateType` variable, or with no fixed period, contributes **no** line.
6. **Regression:** a single loan's **Projection chart** looks exactly as before — `Rate end` and `Goal` labels at their original heights, not shifted.

Worked example for check 3, using `test/fixtures/loan-a-95k.json`: `startMonth 7`, `startYear 2024`, `fixedPeriodMonths 180` → `7 + 180 = 187`, roll 15 years → **2039-07**, labelled `Jul 2039`.

- [ ] **Step 6: Commit**

```bash
git add src/ui.js loan-tracker.html
git commit -m "feat: fixed-period end markers on the combined dashboard chart

Reuses makeMarkersPlugin, already used by the per-loan chart. One dashed
line per fixed-rate loan, in that loan's LOAN_COLORS colour so it is
attributable without a legend, labelled with the loan name over the month.

Adds an optional yOff to the plugin so two loans whose fixed periods end
near each other do not overprint their labels; existing per-loan callers
pass no yOff and are unchanged."
```

---

### Task 3: Paid-to-date breakdown on the dashboard loan cards

**Files:**
- Modify: `test/regression.js` — extend the `require` on line 6, append one test
- Modify: `src/ui.js:518-533` (`renderDashboardLoanCards`)
- Modify: `src/style.css` — add two rules near the other `.dash-loan-card*` rules
- Test: `test/regression.js`

**Interfaces:**
- Consumes: `computeProgressStats(sched, startBal)` from `src/engine.js`, returning `{principalReduced, interestPaid, extrasSoFar, progressPct, latestBal}` — all numbers. Already called at `src/ui.js:523` as `ps`.
- Produces: nothing later tasks depend on.

**Why the test comes first and what it pins.** `principalReduced` is `startBal - latestBal`, so it **includes lump-sum prepayments**, not just the principal portion of instalments. That is exactly why the card shows an `of which lumps` line. This test pins that semantic so a future engine change cannot silently make the card's label a lie. It is a **characterization test**: it passes on the first run against today's engine. That is expected and correct — it is a guard, not a red-green cycle. Do not try to make it fail first.

- [ ] **Step 1: Write the characterization test**

In `test/regression.js`, change line 6 from:

```js
const { genProj, projEndMonth, projFirstMonth, redistributeBudgetAlloc } = require('../src/engine.js');
```

to:

```js
const { genProj, projEndMonth, projFirstMonth, redistributeBudgetAlloc, computeProgressStats } = require('../src/engine.js');
```

Then append to the end of the file:

```js
// --- paid-to-date figures behind the dashboard loan cards ---

test('computeProgressStats: principalReduced includes lump sums, not just instalment principal', () => {
  const sample = JSON.parse(fs.readFileSync(path.join(SAMPLES_DIR, 'loan-a-95k.json'), 'utf8'));
  const loan = JSON.parse(sample.lt_loans)[0];
  const budget = parseFloat(sample['lt_budget_0']);
  const actuals = JSON.parse(sample['confirmed_0_act']);

  const rate = (loan.annualRate + loan.levy) / 100 / 12;
  const postRate = (loan.postFixedRate && loan.fixedPeriodMonths > 0)
    ? (loan.postFixedRate + loan.levy) / 100 / 12
    : 0;
  const startKey = projFirstMonth(loan);
  const { ey, em } = projEndMonth(loan);

  const { sched } = genProj(
    budget, loan.balance, startKey, rate, ey, em,
    {}, loan.lumpMonths || [loan.lumpMonth], actuals,
    loan.lumpEnabled !== false,
    loan.lumpEffect || 'reduce-installment',
    !!loan.balloonEnabled, loan.balloonThreshold || 0,
    loan.fixedPeriodMonths || 0, postRate
  );

  const ps = computeProgressStats(sched, loan.balance);
  const confirmed = sched.filter(s => s.confirmed);
  const instPrincipal = +confirmed.reduce((a, s) => a + s.principal, 0).toFixed(2);

  assert.strictEqual(confirmed.length, 22, 'fixture must have 22 confirmed rows');
  assert.strictEqual(ps.extrasSoFar, 2912, 'confirmed lump sums');
  assert.strictEqual(instPrincipal, 3956.19, 'instalment principal alone');
  assert.strictEqual(ps.principalReduced, 6868.19, 'balance reduction');
  assert.strictEqual(ps.interestPaid, 7668.02, 'confirmed interest');

  // The card's "of which lumps" line exists because of this identity:
  assert.strictEqual(
    +(instPrincipal + ps.extrasSoFar).toFixed(2), ps.principalReduced,
    'principalReduced must equal instalment principal + lump sums'
  );
});
```

- [ ] **Step 2: Run the test**

Run:
```bash
npm test
```
Expected: `pass 13 / fail 0`, including the new `computeProgressStats: principalReduced includes lump sums…`.

If the new test **fails**, stop and report the actual numbers — the fixture or engine has changed since this plan was written, and the card's design assumption needs rechecking before you render anything.

- [ ] **Step 3: Add the card lines**

In `src/ui.js`, inside `renderDashboardLoanCards`, replace this line:

```js
      '<div class="progress-track" style="margin:4px 0 0"><div class="progress-fill" style="width:'+ps.progressPct.toFixed(1)+'%;background:'+color+'"></div></div>'+
```

with:

```js
      paidHtml(ps)+
      '<div class="progress-track" style="margin:4px 0 0"><div class="progress-fill" style="width:'+ps.progressPct.toFixed(1)+'%;background:'+color+'"></div></div>'+
```

Then add this helper immediately **above** `function renderDashboardLoanCards(data){`:

```js
// Paid-to-date lines for a dashboard loan card. All figures come from
// confirmed rows only, so a user who has confirmed nothing sees a zero state.
function paidHtml(ps){
  if(ps.principalReduced<=0&&ps.interestPaid<=0){
    return '<div class="dash-loan-card-paid sub">Nothing confirmed yet</div>';
  }
  let h='<div class="dash-loan-card-paid"><span>Principal paid</span><span>'+fmtE(ps.principalReduced)+'</span></div>';
  if(ps.extrasSoFar>0){
    h+='<div class="dash-loan-card-paid sub"><span>of which lumps</span><span>'+fmtE(ps.extrasSoFar)+'</span></div>';
  }
  h+='<div class="dash-loan-card-paid"><span>Interest paid</span><span>'+fmtE(ps.interestPaid)+'</span></div>';
  return h;
}
```

- [ ] **Step 4: Add the styles**

In `src/style.css`, find the existing `.dash-loan-card-payoff` rule and add directly after it:

```css
.dash-loan-card-paid{display:flex;justify-content:space-between;gap:8px;font-size:.72rem;color:var(--ink);font-variant-numeric:tabular-nums;margin-top:3px}
.dash-loan-card-paid.sub{color:var(--muted);padding-left:8px;font-size:.68rem;margin-top:1px}
```

- [ ] **Step 5: Rebuild and re-run tests**

Run:
```bash
node build.js && npm test
```
Expected: build succeeds, `pass 13 / fail 0`.

- [ ] **Step 6: Manual browser check (required — do not skip)**

Dashboard, with at least two loans:

1. Each card shows `Principal paid` and `Interest paid`, amounts right-aligned against their labels. `fmtE` rounds to whole euros with a Greek `.` thousands separator, so the `loan-a-95k` figures render as `€6.869` and `€7.668` — no decimals. That is correct, matching the balance already shown above them.
2. A loan with confirmed lump sums also shows an indented, muted `of which lumps`; a loan with none shows only the two lines.
3. Cross-check one card against that loan's own tab: `Principal paid` equals opening **Borrowed** minus current **Outstanding**.
4. A loan with nothing confirmed shows the muted `Nothing confirmed yet` and no €0 rows.
5. The progress bar still renders below the new lines, and card heights stay even enough not to break the row.

- [ ] **Step 7: Commit**

```bash
git add test/regression.js src/ui.js src/style.css loan-tracker.html
git commit -m "feat: paid-to-date breakdown on dashboard loan cards

Shows principal paid, of-which-lumps, and interest paid per loan, from
computeProgressStats — which renderDashboardLoanCards already called for
latestBal and progressPct.

principalReduced is startBal - latestBal, so it includes lump-sum
prepayments; the 'of which lumps' line makes that explicit rather than
letting the figure read as instalment principal. Adds a characterization
test pinning that identity (13/13).

All three figures derive from confirmed rows only, so a loan with nothing
confirmed shows a zero state instead of three EUR 0 lines."
```

---

### Task 4: Release v1.10.0

**Files:**
- Modify: `package.json` (version)
- Modify: `loan-tracker.html` (rebuilt with the new stamp)

**Interfaces:**
- Consumes: Tasks 1-3 committed and their manual checks passed.
- Produces: tag `v1.10.0`, a GitHub release, and a redeployed Pages site.

**Do not start this task until all three manual browser checks above have actually been performed and passed.** Two consecutive releases have already shipped without agent-side visual verification; do not make it three by guessing.

- [ ] **Step 1: Bump, rebuild, verify the stamp**

Run:
```bash
npm version 1.10.0 --no-git-tag-version && node build.js && npm test && grep -n "APP_VERSION='v" loan-tracker.html | head -1
```
Expected: `Built loan-tracker.html (v1.10.0)`, `pass 13 / fail 0`, and `const APP_VERSION='v1.10.0';`.

- [ ] **Step 2: Commit and push**

```bash
git add package.json loan-tracker.html
git commit -m "chore: release v1.10.0"
git push origin master
```

- [ ] **Step 3: Tag and release**

```bash
git tag -a v1.10.0 -m "v1.10.0 — dashboard x-axis, fixed-period markers, paid-to-date"
git push origin v1.10.0
gh release create v1.10.0 --title "v1.10.0 — dashboard chart & paid-to-date" --notes-file -
```

Release notes body (pipe via heredoc, as in the v1.9.1 release):

```
## Fixed

**X-axis labels never rendered on either chart.** The tick callback only produced text for January and July, but `maxTicksLimit` makes Chart.js auto-skip ticks first — at 15-month spacing the surviving ticks cycle through four calendar months, which for many loan start dates contains neither. Every label came out empty. Labels now render on every kept tick, with density handled by Chart.js.

## Added

- **Fixed-period end markers on the combined dashboard chart** — one dashed line per fixed-rate loan, in that loan's colour, labelled with the loan name and the month its fixed rate expires.
- **Paid-to-date on each dashboard loan card** — principal paid, of which lump sums, and interest paid. Figures come from confirmed rows only; a loan with nothing confirmed says so.

**Live:** https://stel1os.github.io/loan-tracker/
```

- [ ] **Step 4: Confirm Pages redeployed**

Run:
```bash
gh api repos/stel1os/loan-tracker/pages/builds/latest --jq '{status,commit}'
```
Poll until `status` is `built` (takes ~50s), then confirm the live artifact:
```bash
curl -s https://stel1os.github.io/loan-tracker/loan-tracker.html | grep -o "APP_VERSION='v[0-9.]*'" | head -1
```
Expected: `APP_VERSION='v1.10.0'`

- [ ] **Step 5: Update SPRINT.md**

`SPRINT.md` is gitignored working memory — edit, do not commit. Set the status line to v1.10.0, note the three changes, and record whether the manual browser checks were done and by whom.

---

## Self-Review

**Spec coverage:**

| Spec section | Task |
|---|---|
| Part 1 — x-axis label fix, both charts, `maxTicksLimit` 20→10 | Task 1 |
| Part 2 — markers array, loan colour, 12-char truncation, `yOff` extension | Task 2 |
| Part 2 — `Goal` marker explicitly not ported | Task 2 (no step adds it) |
| Part 3 — three lines, `of which lumps` omitted when zero | Task 3 Step 3 |
| Part 3 — zero state "Nothing confirmed yet" | Task 3 Step 3 |
| Part 3 — `.dash-loan-card-paid` styling, tabular numerals | Task 3 Step 4 |
| Testing — `npm test` stays green; human smoke gate | Every task, Steps 4-6 |
| Build & release — v1.10.0, direct to master, Pages | Task 4 |

No gaps.

**Placeholder scan:** none — every code step carries literal code, every check carries a literal command and its expected output. Expected test numbers (6868.19 / 3956.19 / 2912 / 7668.02 / 22 rows) were produced by running the engine against `test/fixtures/loan-a-95k.json`, not estimated.

**Type consistency:** `ps` is the `computeProgressStats` return object in both `renderDashboardLoanCards` and `paidHtml`; field names `principalReduced`, `interestPaid`, `extrasSoFar`, `progressPct`, `latestBal` match `src/engine.js:129` exactly. Marker objects use `{month, color, label1, label2, yOff}`, matching the keys `makeMarkersPlugin` reads after Task 2 Step 1. `makeMarkersPlugin` is the single name used in both charts.
