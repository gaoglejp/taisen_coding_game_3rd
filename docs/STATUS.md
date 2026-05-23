# Status

Rolling cross-agent status report shared between Claude Code and Codex.
Updated on every push. See `AGENTS.md` for the workflow expectations.

When you push, do these three things in `docs/STATUS.md`:

1. Move the current "Latest" block into "History" (one-line summary).
2. Replace "Latest" with the new PR's details.
3. Refresh "Next 1–3 PRs" and "Open questions" if anything changed.

---

## Latest

- **PR**: #9 — feat(watch): wire watch page to /api/match/:id/public + live turn_event
- **Branch**: `claude/v0.2-implementation-handoff-ZapvB`
- **Date**: 2026-05-23
- **Status**: open, awaiting CI

### What changed

- **Watch page rewired** (`src/app/watch/[matchId]/page.tsx`): drops the
  inline `META` constant for live data. Fetches `/api/match/:id/public`
  on mount and subscribes to `turn_event` over the socket. Header shows
  the real room name, match id, and both players. The board's tank
  positions, directions, and HP, the per-player recognition panels'
  HP / action / damage / scan rows, and the cumulative damage scoreboard
  all derive from received `turn_event` snapshots.
- **`Board()` made data-driven**: takes a `tanks` prop instead of reading
  the static `BOARD.tanks` constant. Obstacle / item rendering and the
  decorative shot ray are still mocked (the simulator doesn't expose
  obstacles / items / shot rays yet — flagged in HANDOFF #3).
- **Commentary feed, timeline events, viewer count, state gallery** kept
  as static placeholders — those panels back onto features the API
  doesn't expose at all yet. The page already labels them as "future".

### Next 1–3 PRs (recommended order)

1. **Blockly → strategy JSON serializer.** The single biggest remaining
   mock. Convert the workspace's actual blocks into the `{ rules,
   fallbackActions }` shape the simulator consumes, and submit that on
   lock. Recommend keeping `MOCK_STRATEGY_JSON` as a "load default"
   button for an empty workspace. Once this lands, two players can run
   genuinely different strategies against each other end-to-end.
2. **Vitest + simulator unit tests** (HANDOFF section 4 item 5). The
   simulator is pure functions — three or four cases (always-hit,
   always-miss, draw on timeout, mutual KO) would cover the basics and
   give us a regression net before adding AP / items / obstacles.
3. **Dashboard "joined rooms" card.** Smallest remaining mock-removal —
   `/api/rooms/visible` already returns real data; the dashboard's
   `MOCK_ROOMS` fallback just needs to go.

### Deferred / out of scope right now

- Admin pages mock removal (same mechanical pattern, lower visibility).
- Real-time room ranking on the result page (needs an aggregation
  endpoint).
- Item / barrier / obstacle support in the simulator (extends
  `TurnSnapshot` additively per decision #9 in `docs/HANDOFF.md`).
- Email confirmation on signup (HANDOFF section 4 item 4).

### Open questions / handoff notes

- The watch page's "state gallery" at the bottom is a design showcase of
  6 visibility states (public / limited / 403 / live↔replay / delayed /
  ended). It's pure mock content and probably shouldn't ship in
  production. Flagged for a UI cleanup PR separately — not removed in
  this PR to keep scope tight.
- `viewerCount` / `delaySeconds` are still placeholder constants. A
  real viewer count needs Socket.io room introspection; delay banner
  needs a per-room "公式戦" flag in `Room.rulePreset`. Both are out of
  scope until product asks for them.
- The `lastTurn` tab on coding renders `MOCK_LAST_TURN`. Still open —
  see history of PR #8 for the two design paths.
- If Codex picks up work next: please update this file's "Latest" block
  when you push, even if the change is small. Keeping the rolling log
  current is what makes the cross-agent handoff usable.

---

## History

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
