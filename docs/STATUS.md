# Status

Rolling cross-agent status report shared between Claude Code and Codex.
Updated on every push. See `AGENTS.md` for the workflow expectations.

When you push, do these three things in `docs/STATUS.md`:

1. Move the current "Latest" block into "History" (one-line summary).
2. Replace "Latest" with the new PR's details.
3. Refresh "Next 1–3 PRs" and "Open questions" if anything changed.

---

## Latest

- **PR**: #74 — feat(blocks): restyle 制御 もし (slate-blue + else-if/else mutator)
- **Branch**: `claude/v0.2-implementation-handoff-ZapvB`
- **Date**: 2026-05-27
- **Status**: open, awaiting CI

### What changed

- **Restyled the 制御 `もし` block to match the attached design**: now **slate-blue**
  (`#5b6b8c`) with a **gear mutator** so players can add 「そうでなければもし」
  (else-if, any number) and 「そうでなければ」(else) branches. Reuses Blockly's
  built-in `controls_if_mutator`, relabeled to Japanese via `Blockly.Msg`
  (もし / 実行 / そうでなければもし / そうでなければ) — inputs `IF0/DO0`, `IF1/DO1`…,
  `ELSE`, with `previousStatement`/`nextStatement` constrained to `Action`.
- **Wired else-if/else into evaluation**: a rule-body `if` statement is now
  `{kind:"if", clauses:[{cond,body}, …], else?}` — `clauses[0]` is the if and the
  rest are else-ifs. The simulator's `runBody` runs the **first true clause's**
  body (and stops; the else does NOT run if any clause matched), otherwise the
  `else`. The PR #73 single-branch `{cond, body}` shape still works (legacy).
- **API** validates the multi-clause `if` (and legacy single-branch) recursively.
- Per the design decision, **action block labels stay Japanese-only** (the image's
  English command suffix like `MOVE_FORWARD` was explicitly declined).
- `tsc` / `lint` (0 errors, 4 pre-existing warnings) / Vitest **183** / `build`
  green. Screenshotted the 制御 flyout (slate-blue もし + gear); live e2e: an
  if/else-if/else body returns the else-if action (`facing==E → MOVE_FORWARD`),
  and the clauses/else shape is accepted by the API. (Could not screenshot the
  expanded on-canvas block — headless flyout-drag is unreliable — but the mutator
  is verified via the serializer test loading a mutated `elseIfCount/hasElse`
  block and via the live API.)

### Still open / next steps

- All three requests from the latest design pass are done (繰り返す removed in
  PR #73; もし wired in #73; もし restyled with else-if/else here). Suggest a
  manual browser pass on the full editor UX (incl. opening the もし gear) next.

### Next 1–3 PRs (recommended order)

1. **Manual test-play pass** by the spec owner using `docs/TESTPLAY.md`
   (the classroom match loop has automated Scope B smoke, but still needs the
   human spec-owner pass).
2. **Decision-gated** backlog (only if product/schema calls are made):
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

- Scope A/Nav/Scope B browser smoke is automated and locally green. The full
  wired v0.2 loop still needs the manual `docs/TESTPLAY.md` pass.
- `docs/ROADMAP.md` remains a draft pending product confirmation.
- `npm run lint` carries 4 pre-existing warnings (unrelated to recent diffs).

## History

- **PR #73** (merged) — feat(blocks): removed the 繰り返す block and wired the 制御
  もし into an ordered rule-body statement model (action / set / if); kept a legacy
  path for stored strategies/bots. (Claude)
- **PR #72** (merged) — feat(blocks): added the 数値・変数 category, fully wired
  incl. variables (number/arith/mod value nodes + a per-player variable store
  persisted across turns). (Claude)
- **PR #71** (merged) — feat(blocks): added the 論理・比較 category, wired into a
  boolean expression tree (and/or/not/bool/compare) so value blocks drive real
  conditions; fixed the API allow-list also rejecting `shot_hit`. (Claude)
- **PR #70** (merged) — feat(blocks): added the 制御 category — もし if-block +
  N回繰り返す repeat-block; palette-only (繰り返す intentionally unimplemented per
  product decision). (Claude)
- **PR #69** (merged) — feat(blocks): added the 自機情報 category — 自分のHP /
  残りターン (Number) + 自分の向き and 上/右/下/左 (Direction); palette-only until
  comparisons land. (Claude)
- **PR #68** (merged) — feat(blocks): added the 前回結果 category — 前回ダメージを
  受けた？ (→ `damaged`) + 前回敵に命中した？ (→ new `shot_hit` perception); both
  functional. (Claude)
- **PR #67** (merged) — feat(blocks): added the 敵情報 category — 敵を検出している？
  (→ `scan_detected`, functional) + three Number distance readouts (palette-only
  until comparisons land). (Claude)
- **PR #66** (merged) — feat(blocks): rebuilt the strategy palette into 行動
  (10 action blocks) + 状態確認 (4 boolean checks); reworked the simulator to a
  relative-direction model (strafe move/shoot, SCAN_AROUND, rotation removed,
  `can_move_*` conditions); included the `/practice` replay layout fix. (Claude)
- **PR #65** (merged) — feat(practice): standalone `/practice` solo battle —
  reuses Blockly + `simulate()` vs built-in bots via `POST /api/practice/simulate`
  (no Match/Socket.io/persistence); route tests + practice E2E. (Codex)
- **PR #63** (merged) — fix(auth): server-side dashboard guard bounces admins
  to the shared admin landing, hardening #62's client-side login redirect;
  navigation E2E covers direct `/dashboard` admin access. (Claude)
- **PR #62** (merged) — fix(auth): client-side login redirect sends
  SYSTEM_ADMIN / ROOM_ADMIN to `/admin` (role-aware landing); regular users
  keep `/dashboard`. Hardened server-side in #63. (Claude)
- **PR #61** (merged) — test(e2e): strengthened the Scope B watch regression —
  anonymous watcher asserts live board/timeline movement (not just a positive
  count) + a second watcher verifies `viewer_count` increment/decrement. (Codex)
- **PR #60** (merged) — fix(watch): allow anonymous Socket.io spectating —
  relaxed `server.ts` `io.use` so cookie-less `/watch` sockets can receive
  read-only `turn_event` / `viewer_count`; write events still require
  `socket.data.userId`. (Claude)
- **PR #59** (merged) — test(e2e): Scope B realtime smoke — taro/hanako lock
  via two contexts → auto battle → result, plus a watcher `viewer_count`
  assertion; single-worker E2E + seed `codingDeadlineAt` reset. (Codex)
- **PR #57** (merged) — fix(nav): wired system-rooms "詳細" to
  `/admin/rooms/:id` and extended E2E to cover room-admin sidenav links. (Claude)
- **PR #56** (merged) — docs: amended the room-auth decision so it matches PR #55
  (`GET /api/admin/rooms/:id` allows own-room ROOM_ADMIN; writes stay sysadmin). (Claude)
- **PR #55** (merged) — fix(nav): navigation audit (`docs/NAV_AUDIT.md`, 6 broken
  → 6 fixed) — `/admin`, `/admin/system`, `/admin/system/settings`, `/practice`,
  dashboard replay→`/watch`; relaxed `GET rooms/:id` for own-room ROOM_ADMIN;
  added `e2e/navigation.spec.ts` + system-admin sidenav coverage. (Codex)
- **PR #53** (merged) — fix(rooms): added the missing `/rooms` index
  so dashboard CTA/empty-state links no longer 404; flagged `/practice` for the
  nav audit follow-up. (Claude)
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
