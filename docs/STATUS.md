# Status

Rolling cross-agent status report shared between Claude Code and Codex.
Updated on every push. See `AGENTS.md` for the workflow expectations.

When you push, do these three things in `docs/STATUS.md`:

1. Move the current "Latest" block into "History" (one-line summary).
2. Replace "Latest" with the new PR's details.
3. Refresh "Next 1–3 PRs" and "Open questions" if anything changed.

---

## Latest

- **PR**: #11 — feat(rooms): wire rooms page hero to /api/rooms/:roomNumber
- **Branch**: `claude/v0.2-implementation-handoff-ZapvB`
- **Date**: 2026-05-23
- **Status**: open, awaiting CI

### What changed

- **`src/app/rooms/[roomNumber]/page.tsx` rewired**: drops
  `MOCK_ROOM`. Fetches `/api/rooms/:roomNumber` on mount with proper
  loading and error states. Header renders the real room number,
  name, kind, status, `expiresAt` (with computed days-left), and
  `activeMemberCount`. The rules summary (board / maxTurns / AP /
  obstacles / coding limit / items) is rendered from a `RULE_DEFAULTS`
  constant — `Room.rulePreset` is in the schema as `Json` but ships
  empty (`{}`), so the page shows game-wide defaults until rule
  presets are populated.
- **Kept as mocks** with a top-of-file comment pointing at this status
  doc: matches list, top-5 ranking, "your record", "your schedule",
  announcements. None of those have backing APIs yet — covered as
  individual follow-ups below.
- **`docs/ROADMAP.md` created** (resolves the open question from the
  prior status block). Defines the v0.2 "definition of done" and groups
  the backlog into milestones A–E with status. `AGENTS.md` now lists it
  as required reading and part of the doc convention. Marked as a draft
  pending product confirmation — milestones are inferred from the
  prototypes + schema, not a written spec, so several scope lines carry
  **(TBD)** markers for the product owner.
- **Note for the next agent**: `/api/rooms/:roomNumber/matches` and
  `/standings` already exist (HANDOFF §1) — the rooms page's mocked
  matches list and standings can be wired without writing new
  endpoints. The earlier "needs an endpoint" note was wrong.

### Next 1–3 PRs (recommended order)

1. **Blockly → strategy JSON serializer** (ROADMAP Milestone A, the
   critical-path blocker). Convert the workspace's actual blocks into
   the `{ rules, fallbackActions }` shape the simulator consumes, and
   submit that on lock. Once this lands, two players can run genuinely
   different strategies against each other end-to-end — this is what
   turns "the simulator runs" into "students actually compete."
2. **Rooms page matches + standings** (ROADMAP Milestone C). Wire the
   already-existing `/api/rooms/:n/matches` and `/api/rooms/:n/standings`
   endpoints into the rooms page panels. Mechanical — no new endpoints.
3. **`src/lib/auth.ts` unit tests** (ROADMAP Milestone E). Vitest is
   wired — cover cookie session round-trip and `getSession` role guards
   before touching auth again.

### Deferred / out of scope right now

- Admin pages mock removal (same mechanical pattern, lower visibility).
- Real-time room ranking on the result page (needs an aggregation
  endpoint).
- Item / barrier / obstacle support in the simulator (extends
  `TurnSnapshot` additively per decision #9 in `docs/HANDOFF.md`).
- Watch page UI cleanup (drop state-gallery, replace placeholder
  commentary / viewer count). Flagged in #9's status block.
- Email confirmation on signup (HANDOFF section 4 item 4).

### Open questions / handoff notes

- **`docs/ROADMAP.md` is a draft pending product review.** Its
  milestones and "definition of done" are inferred from the prototypes
  + schema, not a written spec. Scope lines marked **(TBD)** need a
  product decision: whether obstacles/items/AP, live commentary, 2FA,
  and email confirmation are in v0.2 or post-v0.2. Resolve those before
  building the affected items.
- The rooms page's schedule and announcements still need backing data.
  `/api/rooms/:n/matches` and `/standings` **already exist** (use them);
  announcements would need a new endpoint over the existing
  `Announcement` model.
- The simulator tests intentionally don't exercise an HP_ZERO win —
  no in-bounds starting alignments hit with the current six action
  types. Add coverage once AP / obstacles / items land.
- If Codex picks up work next: please update this file's "Latest" block
  when you push, even if the change is small. Keeping the rolling log
  current is what makes the cross-agent handoff usable.

---

## History

- **PR #10** (merged) — chore(test): Vitest + 9 simulator unit tests +
  wired into CI. HANDOFF section 4 item 5 closed.
- **PR #9** (merged) — feat(watch): wire watch page to
  `/api/match/:id/public` + live `turn_event`. Drops `META` constant;
  tank positions / HP / actions / cumulative damage all live.
- **PR #8** (merged) — feat(coding): wire coding page header to
  `/api/match/:id/state`. Drops `MOCK_MATCH` from the coding page;
  `/state` endpoint extended to include `room`.
- **PR #7** (merged) — feat(result): wire result page to
  `/api/match/:id/result` + AGENTS.md / CLAUDE.md unified +
  `docs/STATUS.md` introduced.
- **PR #6** (merged) — feat(stats): aggregate real match stats from
  `replayData`. Replaced placeholder in `/api/me/stats` with real
  win/loss/turn/damage aggregation.
- **PR #5** (merged) — feat(simulator): turn-by-turn match simulation
  server-side. New `src/lib/match-simulator.ts`; `server.ts` emits
  `turn_event` / `match_result`; battle page consumes them for HP /
  position / direction / log.
- **PR #4** (merged) — ci: lint / type-check / build workflow.
  `.github/workflows/ci.yml` runs `npm ci`, `lint`, `tsc --noEmit`, and
  `next build` on every PR.
