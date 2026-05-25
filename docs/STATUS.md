## Latest

- **PR**: #TBD — feat(rooms): wire 「あなたの予定」 to real match data (暫定定義)
- **Branch**: `codex/v0.2-rooms-schedule`
- **Date**: 2026-05-25
- **Status**: open, awaiting CI

### What changed

- `src/app/rooms/[roomNumber]/page.tsx` の「あなたの予定」をモックから実データ化。既存取得済みの `matches` + `meId` だけで導出し、新規 API/fetch は追加なし。
- 暫定定義を実装: 「このルームで自分が参加している WAITING/CODING/BATTLING のマッチ」を予定として表示し、`codingDeadlineAt` 昇順（null/invalid は末尾、同順は `matchNumber`）で並べ替え。
- 予定行に `#matchNumber` / 対戦相手名（未定は「募集中」）/ status バッジ / 期限（null は「期限なし」）/ リンク（WAITING・CODING→`/match/:id/coding`, BATTLING→`/watch/:id`）を反映。
- 純関数 `selectMySchedule(matches, meId)` を `src/lib/room-schedule.ts` に追加し、Vitest で抽出・並び順・null `meId` をテスト。

### Parallel work (Claude)

- Claude 側は route-handler テスト中心のため、今回の rooms ページ実装とは競合なし（想定）。

### Next 1–3 PRs (recommended order)

1. ブラウザ実機で rooms ページの予定カード表示確認（このコンテナでは未実施）。
2. Product 確認: 「あなたの予定」の正式定義（汎用スケジュール源の有無、終了済み履歴の扱い）。
3. Decision-gated: coding `lastTurn` source, true bracket-tree linkage, 2FA/email confirmation.

### Deferred / out of scope right now

- 終了済みマッチ履歴を「あなたの予定」に含める拡張。
- 専用スケジュールモデル/エンドポイントの新設。
- Commentary feed / obstacles/items/AP など post-v0.2 項目。

### Open questions / handoff notes

- 本PRの「あなたの予定」定義は暫定（`codingDeadlineAt` を予定時刻として利用）。正式仕様確定後に差し替え余地あり。
- ブラウザ表示は headless 環境のため未検証（純関数テストと型/ビルドは green）。

## History

- **#40 — feat(coding): wire countdown timer to `codingDeadlineAt`** — moved to history on 2026-05-25.
- **PR #39** (open) — feat(simulator): room `rulePreset.maxTurns` now applies to live `simulate(...)` runs via `coding_lock`; added simulator option + normalization tests.
- **PR #38** (open) — test(admin): rooms write routes + activity feed route tests; suite to 100, `tsc`/`lint`/`build` clean. (Claude)
- **PR #37** (merged) — feat(admin): room overview activity feed from the
  audit log (`GET /api/admin/rooms/:id/activity`, own-room guard, limit
  clamp) + overview page wiring; `MOCK_ACTIVITIES` removed. (Codex)
- **PR #36** (merged) — test(admin): member + account write-route tests
  (members issue/disable/reissue, users invite/force-reset); suite to 77.
- **PR #34** (merged) — feat(watch): spectator real-data — Socket.io
  presence `viewer_count` (join/disconnecting) + timeline derived from
  `turn_event`/replay; fabricated delta removed. (Codex)
- **PR #32** (merged) — test(admin): matches POST + users PATCH route tests;
  suite to 53.
- **PR #31** (merged) — feat: room announcements (admin CRUD API + admin
  page + student rooms-page wiring; `Announcement` model). (Codex)
- **PR #30** (merged) — test(admin): first route-handler tests (match-cancel
  7, standings 3) + a Vitest `@`→`src` alias so routes can be imported. 37 tests.
- **PR #29** (merged) — feat(admin): wired `TournamentView` as a round-grouped
  real-match list (per `Match.round` columns of `BracketMatch` cards); a true
  bracket tree still needs match-advancement schema linkage.
- **PR #27** (merged) — chore(watch): removed the dev-only state-variations
  gallery (+ its 5 helpers, ~341 lines) from the watch page. Viewer
  count / commentary left as placeholders pending real sources.
- **PR #26** (merged) — feat(admin): wired `RoundRobinView` (head-to-head
  matrix + W/L/D summary) to real match data; `TournamentView` left on mock
  pending bracket-linkage schema.
- **PR #25** (merged) — feat(admin): wired the matches-page create-match
  modal to a real member picker + per-mode `POST …/matches` (roster fetch,
  search/add/remove chips, preview counts); dropped the unbacked 備考 field.
- **PR #24** (merged) — feat(admin): enriched `/api/admin/rooms/:id/standings`
  (per-player avg dmg dealt/taken, avg turns, recent form, recentMatches +
  room meta + summary/end-reason counts) and wired the room standings page
  (table, drawer, KPIs, donut, period filter); dropped fabricated deltas.
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
