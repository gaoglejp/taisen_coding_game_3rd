# Status

Rolling cross-agent status report shared between Claude Code and Codex.
Updated on every push. See `AGENTS.md` for the workflow expectations.

When you push, do these three things in `docs/STATUS.md`:

1. Move the current "Latest" block into "History" (one-line summary).
2. Replace "Latest" with the new PR's details.
3. Refresh "Next 1–3 PRs" and "Open questions" if anything changed.

---

## Latest

- **PR**: #16 — feat(admin): wire system audit page to /api/admin/audit
- **Branch**: `claude/v0.2-implementation-handoff-ZapvB`
- **Date**: 2026-05-23
- **Status**: open, awaiting CI

### What changed

- **`src/app/admin/system/audit/page.tsx` rewired**: drops `MOCK_LOGS`.
  Fetches `/api/admin/audit` (cursor-based). Server-side params: `from`
  (derived from the 1h/24h/7日/30日 period), `actor` (actor search),
  `q` (keyword), `limit=50`. Field renames handled
  (`ipAddress`/`userAgent`/`metadata`). Null actor → "システム"; null
  target/summary/ip → "—". Loading / empty / error rows added.
- **Cursor pagination** via a cursor stack: `cursorStack[i]` is the
  cursor for page `i` (page 0 = `null`). "次" pushes `nextCursor` and
  advances; "前" steps back through the stack. The API is forward-only,
  so the stack is what makes "前" work.
- **Action category + target-type filters are client-side** refinements
  over the loaded page (the API filters by exact `AuditAction` /
  `targetId`, not by category / type). Documented inline; the footer
  notes "(絞り込み後)" when these are active. Added the two enum values
  the prototype's `ACTION_CONFIG` was missing (`USER_DISABLE_2FA`,
  `MEMBER_DISABLE`).
- **Still UI-only**: the CSV / JSON export buttons.
- ROADMAP Milestone D "System audit page" row → ✅.

### Known limitation

Because category/target-type are filtered client-side over a 50-row
page, a page can render fewer than 50 rows when those filters are
active, and "次" advances the *underlying* cursor (not the filtered
view). This is acceptable for an admin log browser; a fully server-side
solution would need the API to accept a category→action-set expansion
and a `targetType` param. Noted for a future API tweak.

### Next 1–3 PRs (recommended order)

1. **Admin room-scoped pages** (ROADMAP Milestone D). Overview / members
   / matches / standings / settings under `/admin/rooms/:id`, wired to
   `/api/admin/rooms/:id/*`. Larger — split per page. Start with the
   overview page.
2. **Blockly → strategy JSON serializer** (ROADMAP Milestone A, the
   critical-path blocker). Needs a product call first: real Blockly
   integration vs. a lightweight rule-builder. Highest-leverage piece
   for actual gameplay once decided.
3. **Admin write actions** (ROADMAP Milestone D "Account actions" +
   room create/delete/archive). Wire the modals that are currently
   UI-only across the admin users / rooms pages to their POST/PATCH/
   DELETE endpoints, with the confirmation flows already drawn.

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
