# Status

Rolling cross-agent status report shared between Claude Code and Codex.
Updated on every push. See `AGENTS.md` for the workflow expectations.

When you push, do these three things in `docs/STATUS.md`:

1. Move the current "Latest" block into "History" (one-line summary).
2. Replace "Latest" with the new PR's details.
3. Refresh "Next 1–3 PRs" and "Open questions" if anything changed.

---

## Latest

- **PR**: #7 — feat(result): wire result page to /api/match/:id/result + share docs across agents
- **Branch**: `claude/v0.2-implementation-handoff-ZapvB`
- **Date**: 2026-05-23
- **Status**: open, awaiting CI

### What changed

- **Result API extended** (`src/app/api/match/[matchId]/result/route.ts`):
  computes per-player stats (final HP, damage dealt / taken, hit rate,
  shoots / scans / moves / hits), `firstDamageTurn`, `firstDamageBy`, and a
  full `hpTimeline` from `Match.replayData`.
- **Result page rewired** (`src/app/match/[matchId]/result/page.tsx`):
  drops `MOCK_RESULT`, `HP_TIMELINE`, `RECENT_MATCHES`, `TURN_HIGHLIGHTS`.
  Fetches `/api/me`, `/api/match/:id/result`, `/api/me/stats`,
  `/api/me/matches?limit=5` on mount. Viewer perspective ("you" = P1 or P2)
  is derived from session vs. player IDs. Win/lose/draw verdict, HP cards,
  stat tiles, HP timeline SVG, first-damage banner, turn highlights, win
  rate card, and recent matches all render from live data. Room ranking
  card removed (no API yet); learning hints kept as static content.
- **AGENTS.md / CLAUDE.md unified**: `AGENTS.md` is now the single shared
  entry point with inviolable rules + workflow expectations; `CLAUDE.md` is
  a one-line `@AGENTS.md` pointer so Claude Code and Codex see the same
  rules.
- **`docs/STATUS.md` introduced** (this file) as the rolling cross-agent
  status report.

### Next 1–3 PRs (recommended order)

1. **Coding page mock removal.** The coding page (`/match/:id/coding`) still
   reads `MOCK_MATCH` for room name / match number / opponent name, and
   submits `MOCK_STRATEGY_JSON` instead of whatever the Blockly workspace
   produces. Wire room/match metadata to `/api/match/:id/public` (which
   already exists) and start capturing real strategy from the editor.
   Touches the player flow most visibly after this PR.
2. **Watch page (`/watch/:id`).** Subscribe to `turn_event` like the battle
   page does, fetch match metadata from `/api/match/:id/public`. Currently
   spectator-only mock data.
3. **Room pages (`/rooms/:roomNumber`).** The room top page, members list,
   matches list, and standings still render from inline mocks. The
   `/api/rooms/...` endpoints already return real data — mechanical swap.

### Deferred / out of scope right now

- Real-time room ranking on the result page (needs an aggregation endpoint).
- Item / barrier / obstacle support in the simulator (extends
  `TurnSnapshot` additively per decision #9 in `docs/HANDOFF.md`).
- Vitest setup + simulator unit tests (HANDOFF section 4 item 5).
- Email confirmation on signup (HANDOFF section 4 item 4).

### Open questions / handoff notes

- The coding page currently submits `MOCK_STRATEGY_JSON` literally; the
  Blockly toolbox UI is rendered but the workspace blocks don't drive the
  payload. Wiring the editor to a real strategy is bigger than a mock swap
  — needs a Blockly → strategy JSON serializer. Recommend a separate PR
  scoped to just that.
- The result page assumes "you" is always P1 or P2 if logged in. Admins
  watching a finished match default to the P1 perspective in the hero card
  — flag for design review if that's not desired.
- If Codex picks up work next: please update this file's "Latest" block
  when you push, even if the change is small. Keeping the rolling log
  current is what makes the cross-agent handoff usable.

---

## History

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
