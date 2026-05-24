# Status

Rolling cross-agent status report shared between Claude Code and Codex.
Updated on every push. See `AGENTS.md` for the workflow expectations.

When you push, do these three things in `docs/STATUS.md`:

1. Move the current "Latest" block into "History" (one-line summary).
2. Replace "Latest" with the new PR's details.
3. Refresh "Next 1–3 PRs" and "Open questions" if anything changed.

---

## Latest

- **PR**: #25 — feat(admin): wire create-match modal to a real member picker + POST
- **Branch**: `claude/v0.2-implementation-handoff-ZapvB`
- **Date**: 2026-05-24
- **Status**: open, awaiting CI

### What changed

- **`src/app/admin/rooms/[roomId]/matches/page.tsx` create-match modal
  wired** (was fully mock — hardcoded chips + a no-op button):
  - Opening the modal fetches the room roster (`GET
    /api/admin/rooms/:id/members?status=ACTIVE`, map `.user`). The
    "対象プレイヤー" box now shows real selected chips (× to remove) and the
    text input filters the roster into a suggestion dropdown (click to add).
  - On 発行, builds the per-mode payload and `POST`s
    `/api/admin/rooms/:id/matches`: MANUAL → `{ player1Id, player2Id,
    startDeadline?, isPublicWatch }` (exactly 2 players); RANDOM →
    `{ playerIds, count, isPublicWatch }` (count = ⌊n/2⌋); ROUND_ROBIN /
    TOURNAMENT → `{ playerIds, isPublicWatch }`. On success it reloads the
    match list and closes.
  - 自動公開観戦 select → `isPublicWatch` (非公開→false, else true); 開始期限
    is bound and only enabled/sent for MANUAL (the endpoint only reads it
    there). The プレビュー 生成件数 / 所要時間 / 公開設定 are now derived from
    the live selection + mode. Submit is disabled until the selection is
    valid (2 for MANUAL, ≥2 otherwise) with a 発行中… state + inline error.
  - Removed the 備考 field — the create endpoint has no note param, so a
    silently-discarded input was worse than dropping it. Extracted a
    `toMatchRow` mapper reused by the mount fetch and the post-create reload.
- `tsc` / `lint` / `build` clean; 27 tests still pass.
- **Not verified in a browser** (headless container): data wiring, types,
  and build are verified, but the modal/suggestions/submit need a manual
  pass.

### Next 1–3 PRs (recommended order)

1. **Manual browser pass** on the recently-wired pages that can't be
   visually confirmed in this headless container: the Blockly editor
   (PR #23), the standings page (PR #24), and this create-match modal
   (PR #25). All are data/build-verified only.
2. **Coding `lastTurn` tab real data** (Milestone A). Surface prior-turn
   perception from the simulator or add `/api/match/:id/lastTurn`; the tab
   still renders `MOCK_LAST_TURN`. **Needs a product call** on the source
   (the match simulates in one shot, so "last turn" during coding is
   undefined without a turn-by-turn loop).
3. **Bracket / round-robin views** on the matches page are still mock
   (`TournamentView` / `RoundRobinView` render hardcoded data); wire them
   from the real match list, or descope to post-v0.2.

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
