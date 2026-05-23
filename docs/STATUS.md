# Status

Rolling cross-agent status report shared between Claude Code and Codex.
Updated on every push. See `AGENTS.md` for the workflow expectations.

When you push, do these three things in `docs/STATUS.md`:

1. Move the current "Latest" block into "History" (one-line summary).
2. Replace "Latest" with the new PR's details.
3. Refresh "Next 1–3 PRs" and "Open questions" if anything changed.

---

## Latest

- **PR**: #18 — feat(admin): wire room matches page (LIST) to /api/admin/rooms/:id/matches
- **Branch**: `claude/v0.2-implementation-handoff-ZapvB`
- **Date**: 2026-05-23
- **Status**: open, awaiting CI

### What changed

- **`src/app/admin/rooms/[roomId]/matches/page.tsx` LIST view rewired**:
  drops `MOCK_MATCHES` / `STATUS_COUNTS`. Fetches
  `/api/admin/rooms/:id/matches` and maps each match to a view model
  carrying both the real `id` (React key, `/watch/:id` link, cancel
  target) and a `#<matchNumber>` display label. Round / players /
  coding-deadline / status / winner (P1·P2 from winnerId) / end-reason
  (mapped to JP) all render from real data. Status-filter counts and the
  header pills (合計 / LIVE / FINISHED / CANCELED) are computed from the
  fetched list. Sidenav room name/number from the same response. Empty /
  error row added; the decorative fixed pagination was replaced with a
  real count.
- **Small API extension**: `GET /api/admin/rooms/:id/matches` now also
  returns `room: { id, name, roomNumber }` (same reasoning as the
  members endpoint — ROOM_ADMIN can't hit the system-admin room detail).
- **Still mock / UI-only**: the TOURNAMENT and ROUND_ROBIN bracket
  views (separate visualization components with their own sample data),
  the create-match modal (MANUAL/RANDOM/ROUND_ROBIN/TOURNAMENT), and the
  cancel-match modal — all POST/PATCH actions for a later write PR.
- **Standings page deferred**: it needs per-player avg-damage /
  avg-turns / recent-form / end-reason-breakdown that the standings API
  doesn't expose. Wiring it would leave too many "—" columns — better
  to add an enriched aggregation endpoint first. Tracked in ROADMAP.

### Next 1–3 PRs (recommended order)

1. **Admin room settings page** (`/admin/rooms/:id/settings`,
   ROADMAP Milestone D). Wire the form to `GET`/`PATCH
   /api/admin/rooms/:id` (name, description, kind, expiresAt,
   watchingPublic, rankingPublic, replayShareEnabled). Note the GET is
   `isSystemAdmin`-gated — confirm the settings page is a system-admin
   surface, or extend the guard, before relying on it.
2. **Blockly → strategy JSON serializer** (ROADMAP Milestone A, the
   critical-path blocker). Needs a product call first: real Blockly
   integration vs. a lightweight rule-builder. Highest-leverage piece
   for actual gameplay once decided.
3. **Admin write actions** (ROADMAP Milestone D). Wire the create /
   cancel / issue / reissue / disable / archive modals that are
   currently UI-only across the admin pages to their POST/PATCH/DELETE
   endpoints, with the confirmation flows already drawn. Also unblocks
   an enriched standings endpoint for the room standings page.

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
