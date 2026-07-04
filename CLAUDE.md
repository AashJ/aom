# AOM

Bun-managed TypeScript monorepo (Turborepo). Workspaces live under `apps/*` and `packages/*`.

- `apps/web` — React 19 web app on Vite + TanStack Router, styled with Tailwind v4.
- `packages/ui` — shared component library and global styles.
- `packages/env` — env parsing/validation (`@aom/env`, zod).
- `packages/config` — shared tooling config (`@aom/config`).

Package manager is **bun** (`bun@1.3.13`); dependency versions are pinned via the workspace `catalog`.

## Commands

Run from the repo root:

- `bun run dev` — start all dev servers (`turbo run dev`).
- `bun run dev:web` — dev server for the web app only.
- `bun run build` — build everything (`turbo run build`).
- `bun run check-types` — typecheck all workspaces.
- `bun run check` — lint + format (`oxlint && oxfmt --write`).

Lint/format is **oxlint + oxfmt**, not ESLint/Prettier.

## Delegating to Codex

The `codex@openai-codex` plugin is installed and the Codex CLI is authenticated (ChatGPT
login). It lets us hand work off to OpenAI Codex from inside Claude Code. **Reach for it based
on how hard/large the task is — not for everything.**

### How to delegate

Use the `/codex:*` slash commands (they run inline and forward to the Codex runtime):

- `/codex:rescue [flags] <what to solve>` — the main delegation entry point. Hands the task to
  the `codex:codex-rescue` subagent. **Write-capable by default** (Codex edits files); pass
  `--read-only` for investigate/diagnose-only. Useful flags:
  - `--background` / `--wait` — run detached vs. block on it.
  - `--resume` / `--fresh` — continue the last Codex run vs. start clean.
  - `--effort none|minimal|low|medium|high|xhigh` — leave unset unless a specific effort is wanted.
  - `--model <model|spark>` — leave unset by default; `spark` maps to the fast model.
- `/codex:review [--base <ref>] [--scope auto|working-tree|branch]` — read-only Codex code
  review of local git state.
- `/codex:adversarial-review [focus...]` — a challenge review that questions the design,
  tradeoffs, and assumptions (not just defect-hunting).
- `/codex:transfer` — move this session into a resumable Codex thread (prints a
  `codex resume <session-id>` command); good for a full handoff.

### Prompting Codex: we own the design, Codex owns the typing

Codex left to its own devices over-abstracts — extra helper layers, wrapper types, speculative
options. Every delegation prompt must therefore carry a strict spec, written by us first:

- **We decide the architecture in the prompt**: exact file paths, the exported symbols with
  their signatures, the data flow / order of operations inside each function, and what calls
  what. Codex implements inside that skeleton; it does not get to invent module boundaries,
  helpers, or layers we didn't name.
- **State the abstraction ceiling explicitly** in the prompt: plain functions unless a class is
  named in the spec; no wrapper/factory/manager layers; no options objects for a single call
  site; no single-use helper functions when the code reads fine inline; no re-export shims
  beyond what the spec lists.
- **Budget the diff** ("one new file, ~60–90 lines"). A blown budget means the design drifted —
  reject and re-issue rather than accept the sprawl.
- **Comments**: only where the underlying API semantics are non-obvious (e.g. WebGPU quirks).
  No narrative or section-header comments.
- If Codex believes the spec is missing a file or abstraction, it should say so in its final
  answer — not silently create it.
- After every run, review the diff for layering creep before showing it for commit: strip
  small violations inline ourselves; re-delegate with tighter constraints if it's structural.

### Tests: Aash writes them, Codex explains them

Aash learns the architecture by writing the tests himself — before or after the
implementation chunk, his choice. Therefore:

- **Codex does not write new test files.** Implementation chunks are code-only. (Exception:
  when a refactor breaks *existing* tests, Codex may mechanically update them so the suite
  stays green — new behavioral coverage is Aash's.)
- **Each implementation chunk is followed by a delegated "test brief"**: Codex explains to
  Aash how to test the new code — which behaviors are worth pinning and *why*, how to set up
  the harness (bun:test, patterns from existing suites), the edge cases that matter, and
  expected values where they're exactly known. The brief teaches "what and why" — it must NOT
  contain paste-able test code.
- After Aash writes the tests, we review them: do they pin behavior (survives refactors)
  rather than implementation details, and do the edge cases actually exercise the failure
  modes named in the brief?

### Managing background Codex jobs

- `/codex:status [job-id]` — active/recent Codex jobs for this repo.
- `/codex:result [job-id]` — the stored final output of a finished job.
- `/codex:cancel [job-id]` — cancel a running background job.

### Setup / health

- `/codex:setup` — check the Codex CLI is installed and logged in; can toggle the stop-time
  review gate. Run this if Codex calls start failing.
- If not logged in: run `!codex login` in the session.
