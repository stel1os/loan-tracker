# Loan Tracker — Project Context

Read **AGENTS.md** first. It has all project context, agent roles, technical rules, and git workflow.

---

## Documentation

| Location | What's there |
|----------|-------------|
| `AGENTS.md` (this repo) | Agent roles, technical rules, git workflow, build order |
| `C:\Users\stkar\OneDrive\Documents\Obsidian Vault\artifacts\loan-tracker\SPEC.md` | Product spec — source of truth for WHAT to build |
| `C:\Users\stkar\OneDrive\Documents\Obsidian Vault\artifacts\loan-tracker\project.md` | One-page project brief |

---

## Current sprint

Check open issues for current sprint: `gh issue list --state open`

For sprint context and build order, see `AGENTS.md`.

---

## Critical reminder

`loan-tracker.html` is >44 KB. **Never use Write or Edit on it.**
Always use `bash cat >>` in chunks. Check size first: `wc -c loan-tracker.html`
