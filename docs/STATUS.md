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

### Next 1–3 PRs (recommended order)

1. **`docs/ROADMAP.md`** — pending product input. The user just asked
   (2026-05-23) whether a "process to completion" doc exists; today
   the closest is HANDOFF section 4 + this file's "Next 1-3". If the
   answer is "yes, please write one", that PR comes first and frames
   the rest. Track the question under "Open questions" below.
2. **Blockly → strategy JSON serializer.** The single biggest remaining
   mock. Convert the workspace's actual blocks into the `{ rules,
   fallbackActions }` shape the simulator consumes, and submit that on
   lock. Once this lands, two players can run genuinely different
   strategies against each other end-to-end.
3. **`/api/rooms/:roomNumber/matches` endpoint** + rooms page wiring.
   The rooms page's "進行中・募集中のマッチ" panel is currently mocked;
   the underlying Match table has everything we need. Mechanical work
   once the endpoint exists.

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

- **NEW**: User asked (2026-05-23) whether the repo has a
  "process-to-completion" document. Today it doesn't — HANDOFF
  section 4 is a backlog, STATUS is a rolling log, neither defines
  the v0.2 "done" criteria or milestones. A `docs/ROADMAP.md` would
  cover that gap. Awaiting confirmation from the user before writing
  it (so we don't fabricate milestones unilaterally).
- The rooms page's matches list, standings, schedule, and
  announcements need backing APIs. Reasonable next endpoints:
  `/api/rooms/:n/matches?status=`, `/api/rooms/:n/standings`,
  `/api/rooms/:n/announcements`. None of those exist yet.
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
