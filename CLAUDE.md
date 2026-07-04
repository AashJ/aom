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

### Managing background Codex jobs

- `/codex:status [job-id]` — active/recent Codex jobs for this repo.
- `/codex:result [job-id]` — the stored final output of a finished job.
- `/codex:cancel [job-id]` — cancel a running background job.

### Setup / health

- `/codex:setup` — check the Codex CLI is installed and logged in; can toggle the stop-time
  review gate. Run this if Codex calls start failing.
- If not logged in: run `!codex login` in the session.
