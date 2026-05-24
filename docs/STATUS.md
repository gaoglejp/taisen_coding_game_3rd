# Status

Rolling cross-agent status report shared between Claude Code and Codex.
Updated on every push. See `AGENTS.md` for the workflow expectations.

When you push, do these three things in `docs/STATUS.md`:

1. Move the current "Latest" block into "History" (one-line summary).
2. Replace "Latest" with the new PR's details.
3. Refresh "Next 1–3 PRs" and "Open questions" if anything changed.

---

## Latest

- **PR**: #24 — feat(admin): enrich standings endpoint + wire room standings page
- **Branch**: `claude/v0.2-implementation-handoff-ZapvB`
- **Date**: 2026-05-24
- **Status**: open, awaiting CI

### What changed

- **`/api/admin/rooms/:id/standings` enriched** (additive — existing
  consumers unaffected; the room overview/members pages use the *player*
  endpoint `/api/rooms/:n/standings`, not this one):
  - Per player, now also returns `avgDamageDealt`, `avgDamageTaken`,
    `avgTurns`, `recent` (last 5 W/L/D, most-recent-first), and
    `recentMatches` (last 8 `{ matchNumber, opponentName, result,
    endReason, turns }`). Damage is summed from `replayData.turns` —
    per-turn `damaged` is damage *taken*, so a player's dealt damage is the
    opponent's `damaged` summed (mirrors `result/route.ts`).
  - Adds `room: { id, name, roomNumber }` and a `summary` block:
    `totalMatches`, `avgTurns`, `avgWinRate`, `firstDamageWinRate`
    (% of decisive matches the first-hit dealer won), and
    `endReasonCounts` for the donut.
- **`src/app/admin/rooms/[roomId]/standings/page.tsx` wired** to it
  (was fully mock): fetches on mount and whenever the period filter
  changes (全期間 / 直近7日 / 直近30日 / 任意期間 → `from`/`to`). The
  ranking table, win-rate bars, recent-form dots, the detail drawer
  (per-player stats + real 直近マッチ list), the KPI tiles, the end-reason
  donut, and the sidenav room name are all live now. Loading/error/empty
  states added; selection is by id so it survives refetches.
  - **Dropped the fabricated period-over-period delta badges** (+8, −2.1…)
    — they need historical comparison we don't store, so showing them as
    real would be misleading. Relabeled the 4th KPI from the undefined
    "FirstDamage取得率" to "先制ダメージ勝率" to match what's actually
    computed.
- `tsc` / `lint` / `build` clean; 27 tests still pass (no route-handler
  tests added, consistent with the repo).
- **Not verified in a browser** (no display here) — the data wiring,
  types, and build are verified, but the rendered table/donut/drawer need
  a manual pass.

### Next 1–3 PRs (recommended order)

1. **Manual browser pass** on the Blockly editor (PR #23) and this
   standings page (PR #24) — both are data/build-verified but not visually
   confirmed in this headless container.
2. **Coding `lastTurn` tab real data** (Milestone A). Surface prior-turn
   perception from the simulator or add `/api/match/:id/lastTurn`; the tab
   still renders `MOCK_LAST_TURN`.
3. **Create-match modal real player-picker** (matches page) — still uses a
   hardcoded chip list; needs a member-search backed by
   `/api/admin/rooms/:id/members` before its `POST …/matches` can be wired.

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
- The rooms page's "あなたの予定" schedule and announcements still need
  backing data. Announcements would need a new endpoint over the
  existing `Announcement` model; the schedule needs a defined source
  (upcoming matches? coding deadlines?) — **TBD**.
- The simulator tests intentionally don't exercise an HP_ZERO win —
  no in-bounds starting alignments hit with the current six action
  types. Add coverage once AP / obstacles / items land.
- If Codex picks up work next: please update this file's "Latest" block
  when you push, even if the change is small. Keeping the rolling log
  current is what makes the cross-agent handoff usable.

---

## History

- **PR #23** (merged) — feat(coding): real Blockly (v12) strategy editor +
  `strategy-blocks.ts` workspace→`Strategy` serializer; coding page submits
  the live strategy instead of a stub. Milestone A blocker cleared.
- **PR #22** (merged) — feat(admin): match-cancel endpoint
  (`POST /api/admin/rooms/:id/matches/:matchId/cancel`) + wired the
  matches-page cancel modal. Closed out the admin write-action surface.
- **PR #21** (merged) — feat(admin): wire system rooms + users page write
  actions. Rooms: create / soft-delete / archive↔restore. Users:
  invite / disable / force-password-reset, with invite & reset links
  surfaced one-time via a new `LinkResult` copy helper (no email infra).
- **PR #20** (merged) — feat(admin): wire room member write actions
  (issue / reissue / disable) on
  `src/app/admin/rooms/[roomId]/members/page.tsx`. First real admin
  mutations; removed `MOCK_ISSUED_CODES`; works for ROOM_ADMIN +
  SYSTEM_ADMIN.
- **PR #19** (merged) — feat(admin): wire room settings page to
  `/api/admin/rooms/:id` (GET/PATCH + archive/restore/delete),
  SYSTEM_ADMIN-only per product decision. rulePreset round-trips but is
  simulator-inert.
- **PR #18** (merged) — feat(admin): wire room matches page (LIST) to
  `/api/admin/rooms/:id/matches`. Bracket views + create/cancel modals
  still mock; matches endpoint extended to return `room`.
- **PR #17** (merged) — feat(admin): wire room members page to
  `/api/admin/rooms/:id/members` (+ standings for W/L/D). Members
  endpoint extended to return `room`.
- **PR #16** (merged) — feat(admin): wire system audit page (cursor
  pagination; category/type filtered client-side) + room overview page
  (`/api/admin/rooms/:id` + matches/standings; activity still mock).
- **PR #15** (merged) — feat(admin): wire system rooms page to
  `/api/admin/rooms` (server-side filter + pagination + global status
  count pills). ROADMAP Milestone D rooms-page row done.
- **PR #14** (merged) — feat(admin): wire system users page to
  `/api/admin/users` (server-side filter + pagination). ROADMAP
  Milestone D users-page row done.
- **PR #13** (merged) — test(auth): 15 unit tests for `src/lib/auth.ts`
  (token round-trip, role guards, `getSession` branches with mocked
  cookies + Prisma). Suite total 24. ROADMAP Milestone E auth row done.
- **PR #12** (merged) — feat(rooms): wire matches list + standings +
  your-record to `/api/rooms/:n/{matches,standings}`. ROADMAP Milestone
  C mostly done (schedule + announcements remain).
- **PR #11** (merged) — feat(rooms): wire rooms page hero to
  `/api/rooms/:roomNumber` + add `docs/ROADMAP.md` (v0.2 definition of
  done + milestones A–E).
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
