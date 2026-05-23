# Status

Rolling cross-agent status report shared between Claude Code and Codex.
Updated on every push. See `AGENTS.md` for the workflow expectations.

When you push, do these three things in `docs/STATUS.md`:

1. Move the current "Latest" block into "History" (one-line summary).
2. Replace "Latest" with the new PR's details.
3. Refresh "Next 1–3 PRs" and "Open questions" if anything changed.

---

## Latest

- **PR**: #21 — feat(admin): wire system rooms page write actions (create / delete / archive·restore)
- **Branch**: `claude/v0.2-implementation-handoff-ZapvB`
- **Date**: 2026-05-23
- **Status**: open, awaiting CI

### What changed

- **`src/app/admin/system/rooms/page.tsx` write actions wired**
  (SYSTEM_ADMIN scope):
  - **作成 (create)**: the create modal `POST`s
    `{ name, kind, expiresAt? }` to `/api/admin/rooms`, then resets to
    page 1 and reloads the list + header count pills. Submit is disabled
    until a name is entered and shows a 作成中… spinner; API errors render
    inline in the modal.
  - **削除 (delete)**: the confirm modal (room-number re-type gate)
    `DELETE`s `/api/admin/rooms/:id` (soft delete → `DELETED`), then
    reloads list + counts. Inline error + 削除中… spinner.
  - **ｱｰｶｲﾌﾞ / 復元 (archive·restore)**: the per-row button now toggles on
    `room.status` — `POST /api/admin/rooms/:id/archive` for ACTIVE rooms,
    `…/restore` for ARCHIVED ones — with a per-row busy/disabled state,
    then reloads.
  - Extracted the header-count fetch into a `loadCounts` `useCallback`
    (was a one-shot mount effect) so every mutation refreshes the pills.
    Its mount call is deferred via `setTimeout(0)` to satisfy the new
    `react-hooks/set-state-in-effect` lint rule, mirroring how the
    existing debounced `load` effect already defers.
  - The 詳細 / 任命 row buttons and the create modal's "管理者ユーザー検索"
    field stay inert — they need a user-picker / detail route that isn't
    built yet, so `initialAdminId` is not sent on create.

### Next 1–3 PRs (recommended order)

1. **Remaining admin write actions** (ROADMAP Milestone D). Members and
   the system rooms page are done; still to wire: the users-page
   invite/disable/reset modals (`POST /api/admin/users/invite`,
   `PATCH /api/admin/users/:id`, `POST .../force-password-reset`).
   **Match-cancel still needs a new endpoint** (`MATCH_CANCEL` audit
   action exists, route doesn't).
2. **Blockly → strategy JSON serializer** (ROADMAP Milestone A, the
   critical-path blocker). Needs a product call first: real Blockly
   integration vs. a lightweight rule-builder. Highest-leverage piece
   for actual gameplay once decided.
3. **Enriched standings endpoint + room standings page** (ROADMAP
   Milestone D). Add per-player avg-damage / avg-turns / recent-form
   (from `replayData`) to `/api/admin/rooms/:id/standings`, then wire the
   standings page that was deferred in PR #18.

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
