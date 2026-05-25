# Status

Rolling cross-agent status report shared between Claude Code and Codex.
Updated on every push. See `AGENTS.md` for the workflow expectations.

When you push, do these three things in `docs/STATUS.md`:

1. Move the current "Latest" block into "History" (one-line summary).
2. Replace "Latest" with the new PR's details.
3. Refresh "Next 1–3 PRs" and "Open questions" if anything changed.

---

## Latest

- **PR**: #53 — fix(rooms): add the missing `/rooms` index (dashboard CTA 404)
- **Branch**: `claude/v0.2-implementation-handoff-ZapvB`
- **Date**: 2026-05-25
- **Status**: open, awaiting CI

### What changed

- **Bug (found in test play):** the dashboard's "⚔ 対戦ルームに入る" CTA and
  the empty-state "ルームを探す" link both pointed at `/rooms`, but only
  `/rooms/[roomNumber]` existed → **404**. (The per-room cards already linked
  correctly.)
- **Fix:** added `src/app/rooms/page.tsx` — a room-picker index that lists the
  user's visible rooms (`/api/rooms/visible`) with `入室する` links to each
  `/rooms/[roomNumber]`; loading / empty states; `TopbarPaper` chrome. No
  prototype existed for this index, so it's intentionally minimal and
  style-consistent (mirrors the dashboard room card).
- **Note:** the dashboard's `🧩 練習する` → `/practice` is a *separate* dead
  link (practice mode is unimplemented / out of scope) — flagged, not fixed
  here.
- `tsc` / `lint` / `build` clean (`/rooms` route registered); 143 tests
  unaffected.

### Parallel work (Codex)

- Merged Codex work: announcements (#31), spectator real-data (#34), room
  activity feed (#37), `rulePreset.maxTurns` → simulator (#40), coding
  countdown → `codingDeadlineAt` (#42), rooms "your schedule" (#44), player
  read-API tests (#46), match read-API tests (#48), Playwright E2E Scope-A
  smoke (#51).
- **Next Codex task ready:** Playwright E2E **Scope B** — two browser contexts
  for taro/hanako coding→lock→battle→result + watch viewer-count (the
  follow-up flagged in `docs/CODEX_TASK_e2e_smoke.md`). Final manual
  verification remains Claude/人間 via `docs/TESTPLAY.md`.

### Next 1–3 PRs (recommended order)

1. **Playwright E2E Scope B** — two browser contexts for
   taro/hanako coding→lock→battle→result, plus watch viewer-count smoke.
2. **Manual test-play pass** by the spec owner using `docs/TESTPLAY.md`
   (the wired loop has never been run end-to-end in a browser).
3. **Decision-gated** backlog (only if product/schema calls are made):
   `InviteCode` model + signup validation, 2FA, email confirmation, coding
   `lastTurn` source, true tournament bracket linkage, obstacles/items.
   Plus the standalone `next-auth` dependency removal (no decision needed).

### Deferred / out of scope right now

- Commentary feed (watch) — placeholder, post-v0.2 (no backing system).
- Obstacles / items / AP in the simulator — post-v0.2 (only `maxTurns` wired).
- Coding `lastTurn` tab — needs a product call (one-shot simulation).
- True tournament bracket *tree* — needs `Match` advancement linkage (schema).
- `RoomActivity` model producers remain unused; activity is unified on
  `AuditLog` (per #37).

### Open questions / handoff notes

- Scope A browser smoke is automated and locally green. The full wired v0.2
  loop still needs **Scope B E2E** and the manual `docs/TESTPLAY.md` pass.
- `docs/ROADMAP.md` remains a draft pending product confirmation.
- `npm run lint` carries 4 pre-existing warnings (unrelated to recent diffs).

## History

- **PR #52** (merged) — fix(proxy): keep `/watch` anonymous — removed it from
  the `proxy.ts` matcher (public spectating is `no-auth`); recorded proxy.ts +
  #51 auth fixes as HANDOFF decision #11. (Claude)
- **PR #51** (merged) — test(e2e): Playwright Scope-A smoke (4-role login +
  protected redirect + room page) + CI `e2e` job with `postgres:16`; the smoke
  surfaced & fixed 3 auth bugs (cookie `secure`-on-HTTPS, logout `prefetch`,
  login credentials) and added `src/proxy.ts` edge guard. (Codex)
- **PR #48** (merged) — test(match-api): route-handler tests for
  `/api/match/[matchId]/{public,state,result,replay}`; suite to 143 and
  handler-level API coverage complete. (Codex)
- **PR #46** (merged) — test(player): route-handler tests for player read
  APIs (`rooms/:n` + matches/standings, `me/stats` aggregation, `me/matches`);
  suite 112 → 128. (Codex)
- **PR #44** (merged) — feat(rooms): wired 「あなたの予定」 to real match data
  (`selectMySchedule`, interim definition: own active matches by
  `codingDeadlineAt`). Milestone C complete. (Codex)
- **PR #42** (merged) — feat(coding): wired the coding countdown to
  `codingDeadlineAt` (`secondsUntil` pure fn, 300s fallback). (Codex)
- **PR #40** (merged) — feat(simulator): room `rulePreset.maxTurns` now
  applies to live `simulate(...)` via `coding_lock` (+ normalization). (Codex)
- **PR #38** (merged) — test(admin): rooms write routes + activity feed route
  tests; suite to 100. (Claude)
- **PR #37** (merged) — feat(admin): room overview activity feed from the
  audit log (`GET /api/admin/rooms/:id/activity`); `MOCK_ACTIVITIES` removed. (Codex)
- **PR #36** (merged) — test(admin): member + account write-route tests
  (members issue/disable/reissue, users invite/force-reset); suite to 77. (Claude)
- **PR #34** (merged) — feat(watch): spectator real-data — Socket.io presence
  `viewer_count` + timeline from `turn_event`/replay; fabricated delta removed. (Codex)
- **PR #32** (merged) — test(admin): matches POST + users PATCH route tests;
  suite to 53. (Claude)
- **PR #31** (merged) — feat: room announcements (admin CRUD API + admin page
  + student rooms-page wiring; `Announcement` model). (Codex)
- **PR #30** (merged) — test(admin): first route-handler tests (match-cancel +
  standings) + a Vitest `@`→`src` alias; 37 tests. (Claude)
- **PR #29** (merged) — feat(admin): `TournamentView` as a round-grouped
  real-match list; true bracket tree still needs schema linkage. (Claude)
- **PR #27** (merged) — chore(watch): removed the dev-only state-variations
  gallery (+ 5 helpers). (Claude)
- **PR #26** (merged) — feat(admin): `RoundRobinView` head-to-head matrix +
  W/L/D summary from real match data. (Claude)
- **PR #25** (merged) — feat(admin): create-match modal → real member picker +
  per-mode `POST …/matches`; dropped the unbacked 備考 field. (Claude)
- **PR #24** (merged) — feat(admin): enriched `/api/admin/rooms/:id/standings`
  (avg dmg/turns/recent-form + summary) + wired the standings page. (Claude)
- **PR #23** (merged) — feat(coding): real Blockly (v12) editor +
  `strategy-blocks.ts` workspace→`Strategy` serializer. Milestone A unblocked. (Claude)
- **PR #22** (merged) — feat(admin): match-cancel endpoint + matches-page modal. (Claude)
- **PR #21** (merged) — feat(admin): system rooms + users page write actions
  (create/delete/archive·restore; invite/disable/reset via `LinkResult`). (Claude)
- **PR #20** (merged) — feat(admin): room member write actions
  (issue/reissue/disable); removed `MOCK_ISSUED_CODES`. (Claude)
- **PR #19** (merged) — feat(admin): room settings page → `/api/admin/rooms/:id`
  (GET/PATCH + archive/restore/delete), SYSTEM_ADMIN-only. (Claude)
- **PR #18** (merged) — feat(admin): room matches page (LIST) → real data. (Claude)
- **PR #17** (merged) — feat(admin): room members page → real data + standings. (Claude)
- **PR #16** (merged) — feat(admin): system audit page + room overview page. (Claude)
- **PR #15** (merged) — feat(admin): system rooms page → `/api/admin/rooms`. (Claude)
- **PR #14** (merged) — feat(admin): system users page → `/api/admin/users`. (Claude)
- **PR #13** (merged) — test(auth): 15 unit tests for `src/lib/auth.ts`. (Claude)
- **PR #12** (merged) — feat(rooms): matches list + standings + your-record. (Claude)
- **PR #11** (merged) — feat(rooms): rooms page hero + added `docs/ROADMAP.md`. (Claude)
- **PR #10** (merged) — chore(test): Vitest + 9 simulator unit tests + CI. (Claude)
- **PR #9** (merged) — feat(watch): wire watch page to `/api/match/:id/public`
  + live `turn_event`. (Claude)
- **PR #8** (merged) — feat(coding): wire coding page header to `/api/match/:id/state`. (Claude)
- **PR #7** (merged) — feat(result): wire result page + shared docs introduced. (Claude)
- **PR #6** (merged) — feat(stats): real `/api/me/stats` aggregation from `replayData`. (Claude)
- **PR #5** (merged) — feat(simulator): turn-by-turn server-side simulation. (Claude)
- **PR #4** (merged) — ci: lint / type-check / build workflow. (Claude)

> Note: odd-numbered PRs between Codex's entries (e.g. #39/#41/#43/#45/#47/#49)
> are Claude's docs-only commits (Codex task briefs + this status log) and are
> omitted here to keep the change log focused.
