# Status

Rolling cross-agent status report shared between Claude Code and Codex.
Updated on every push. See `AGENTS.md` for the workflow expectations.

When you push, do these three things in `docs/STATUS.md`:

1. Move the current "Latest" block into "History" (one-line summary).
2. Replace "Latest" with the new PR's details.
3. Refresh "Next 1–3 PRs" and "Open questions" if anything changed.

---

## Latest

- **PR**: #8 — feat(coding): wire coding page header to /api/match/:id/state
- **Branch**: `claude/v0.2-implementation-handoff-ZapvB`
- **Date**: 2026-05-23
- **Status**: open, awaiting CI

### What changed

- **`/api/match/:matchId/state` extended** to include `room: { id, name,
  roomNumber }`. Cheaper than a second fetch from `/public` and keeps the
  coding page on a single auth-gated endpoint.
- **Coding page header rewired** (`src/app/match/[matchId]/coding/page.tsx`):
  drops `MOCK_MATCH`. Fetches `/api/me` + `/api/match/:id/state` in parallel
  on mount, derives opponent from session vs. player IDs, and renders the
  real room name, match number, and opponent display name.
- **`MOCK_STRATEGY_JSON` retained** (with a comment explaining why). The
  Blockly editor still doesn't drive the strategy payload — wiring a
  Blockly → JSON serializer is its own focused PR (see Open questions).
- **`MOCK_LAST_TURN` retained** on the `lastTurn` tab. The simulator
  doesn't yet expose previous-turn data on a re-match, so we can't fetch
  this until either the simulator carries forward perception or a new
  `/api/match/:id/lastTurn` endpoint is added.

### Next 1–3 PRs (recommended order)

1. **Watch page (`/watch/:id`).** Subscribe to `turn_event` like the battle
   page does and fetch match metadata from `/api/match/:id/public`.
   Currently spectator-only mock data. Smallest remaining player-facing
   page.
2. **Blockly → strategy JSON serializer.** The hardest mock-removal:
   convert the workspace's actual blocks into the `{ rules,
   fallbackActions }` shape the simulator expects, and submit that on
   lock. Once this lands, two players can run genuinely different
   strategies against each other. Recommend keeping `MOCK_STRATEGY_JSON`
   as a "load default" button for empty workspaces.
3. **Vitest + simulator unit tests** (HANDOFF section 4 item 5). The
   simulator is pure functions and is exactly the kind of code where
   tests pay off. Three or four cases (always-hit, always-miss, draw on
   timeout, mutual KO) would cover the basics. Adding Vitest also
   unblocks future tests for `src/lib/auth.ts`.

### Deferred / out of scope right now

- Dashboard room cards / admin pages mock removal (still on inline mocks;
  same mechanical pattern as the result/coding wiring).
- Real-time room ranking on the result page (needs an aggregation
  endpoint).
- Item / barrier / obstacle support in the simulator (extends
  `TurnSnapshot` additively per decision #9 in `docs/HANDOFF.md`).
- Email confirmation on signup (HANDOFF section 4 item 4).

### Open questions / handoff notes

- The coding page submits `MOCK_STRATEGY_JSON` literally — wiring a real
  Blockly serializer is the highest-leverage remaining mock to remove.
  See PR #2 in the queue above.
- The `lastTurn` tab on coding renders `MOCK_LAST_TURN`. Two viable paths
  to make it real: (a) the simulator surfaces the prior turn's perception
  back to the participants between matches; (b) a new
  `/api/match/:id/lastTurn` endpoint reads the last turn of the previous
  match in the same room. Flag for design discussion before picking one.
- If Codex picks up work next: please update this file's "Latest" block
  when you push, even if the change is small. Keeping the rolling log
  current is what makes the cross-agent handoff usable.

---

## History

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
