# Project guide for AI agents

This file is the shared entry point for AI coding agents working on this
repository — both Claude Code and Codex. `CLAUDE.md` re-exports this file
(`@AGENTS.md`) so the two harnesses see the same rules.

## Before you start

1. Read `docs/HANDOFF.md`. It is the durable record of what is built, what
   design calls have been locked in, and what is intentionally unfinished.
   Section 1 maps page routes to prototypes and lists API routes; section 3
   collects design decisions that should not be silently undone; section 4 is
   the prioritized TODO list.
2. Read `docs/ROADMAP.md`. It defines what "v0.2 完成" means and groups the
   backlog into milestones (A–E) with status, so you can see how close the
   project is and what the critical path is.
3. Skim `docs/STATUS.md`. It is the rolling cross-agent status report —
   updated on every push — with the latest PR outcome, the next 1–3
   recommended steps, and any open questions.

<!-- BEGIN:nextjs-agent-rules -->
## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may
all differ from your training data. Read the relevant guide in
`node_modules/next/dist/docs/` before writing any code. Heed deprecation
notices. In particular:

- Dynamic route params arrive as `Promise<{ id: string }>`; await them.
- Route handlers use `NextRequest` / `NextResponse`; the older `Request`
  signature is gone.
- A custom `server.ts` is required for Socket.io (see decision #1 in
  `docs/HANDOFF.md`).
<!-- END:nextjs-agent-rules -->

## Inviolable rules

- The 17 prototypes in `project/*.html` are the visual source of truth. React
  pages should be visually equivalent — do not redesign without being asked.
- Role-aware chrome lives in `TopbarPaper` / `TopbarAdmin` / `ScopeBanner`
  only. Do not duplicate role logic into pages.
- Realtime entrypoint is `tsx watch server.ts` (mounts Next + Socket.io on one
  port). Do not switch to `next dev`.
- Cookie sessions via `src/lib/auth.ts`. `next-auth` is unused; remove it if
  you do a dep cleanup, but don't introduce a parallel auth path.

## Workflow expectations

- Work on the branch named in your task brief; do not push to `main`
  directly. Create a PR (not draft) when changes are ready for review.
- Run `npx tsc --noEmit` and `npm run lint` before pushing. CI
  (`.github/workflows/ci.yml`) will also run these plus `npm run build`.
- After every push, update `docs/STATUS.md`:
  - Move the previous "Latest" entry into "History".
  - Fill in the new "Latest" block with PR number, outcome, what changed,
    and the next 1–3 recommended steps.
  - Note any open questions or handoff items the next agent should see.
- When you finish a meaningful chunk of work, update `docs/HANDOFF.md` too —
  section 4 (unfinished) and, if you locked in a new design call, section 3.

## Two-file convention

- `AGENTS.md` (this file) — short. Lists what to read, inviolable rules,
  workflow expectations. Both agents follow it.
- `CLAUDE.md` — one line: `@AGENTS.md`. Claude Code's harness resolves the
  `@` reference and reads this file.
- `docs/HANDOFF.md` — the long-form implementation record. Sections 3 (design
  decisions) and 4 (TODOs) are the most important to keep current.
- `docs/ROADMAP.md` — the milestone map and v0.2 definition of done. Update a
  milestone row when its state changes.
- `docs/STATUS.md` — the rolling status report shared with Codex. Updated on
  every push.
