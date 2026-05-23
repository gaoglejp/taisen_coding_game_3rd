# Status

Rolling cross-agent status report shared between Claude Code and Codex.
Updated on every push. See `AGENTS.md` for the workflow expectations.

When you push, do these three things in `docs/STATUS.md`:

1. Move the current "Latest" block into "History" (one-line summary).
2. Replace "Latest" with the new PR's details.
3. Refresh "Next 1–3 PRs" and "Open questions" if anything changed.

---

## Latest

- **PR**: #10 — chore(test): add Vitest + 9 simulator unit tests + wire into CI
- **Branch**: `claude/v0.2-implementation-handoff-ZapvB`
- **Date**: 2026-05-23
- **Status**: open, awaiting CI

### What changed

- **Vitest 3.2.4 added** as a dev dependency. New scripts: `npm test`
  (CI-friendly single run) and `npm run test:watch` (interactive). The
  config lives at `vitest.config.ts` and picks up any
  `src/**/*.test.{ts,tsx}` files.
- **`src/lib/match-simulator.test.ts`**: 9 unit tests covering
  - Both-wait → TIMEOUT, no HP loss
  - MOVE_FORWARD advances when clear / stays put at the wall
  - SCAN's `scan_detected` only fires when opponent is on the forward ray
  - Two non-aligned strategies still TIMEOUT with full HP
  - SHOOT against a non-aligned target registers MISS
  - First-matching-rule wins (catch-all falls through correctly)
  - `null` strategy falls back to WAIT
  - Per-turn snapshot shape and ordering invariants
- **CI extended** (`.github/workflows/ci.yml`): `npm test` runs after
  `tsc --noEmit` and before `next build`. Test failures now block PRs.
- **HANDOFF section 4 item 5** rewritten — no longer "no automated tests".

### Next 1–3 PRs (recommended order)

1. **Dashboard "joined rooms" card.** Smallest remaining mock-removal —
   `/api/rooms/visible` already returns real data; the dashboard's
   `MOCK_ROOMS` fallback just needs to go. Quick win.
2. **Blockly → strategy JSON serializer.** The single biggest remaining
   mock. Convert the workspace's actual blocks into the `{ rules,
   fallbackActions }` shape the simulator consumes, and submit that on
   lock. Recommend keeping `MOCK_STRATEGY_JSON` as a "load default"
   button. Once this lands, two players can run genuinely different
   strategies against each other end-to-end.
3. **`src/lib/auth.ts` unit tests.** Vitest is now wired — write tests
   for cookie session round-trip and `getSession` role checks before
   touching anything in auth again.

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

- The simulator tests intentionally don't exercise an HP_ZERO win
  outcome — none of the in-bounds starting alignments lead to a hit
  with the current six action types. Once the simulator gains AP /
  obstacles / items, add coverage there.
- If Codex picks up work next: please update this file's "Latest" block
  when you push, even if the change is small. Keeping the rolling log
  current is what makes the cross-agent handoff usable.

---

## History

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
