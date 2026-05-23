# Status

Rolling cross-agent status report shared between Claude Code and Codex.
Updated on every push. See `AGENTS.md` for the workflow expectations.

When you push, do these three things in `docs/STATUS.md`:

1. Move the current "Latest" block into "History" (one-line summary).
2. Replace "Latest" with the new PR's details.
3. Refresh "Next 1–3 PRs" and "Open questions" if anything changed.

---

## Latest

- **PR**: #19 — feat(admin): wire room settings page to /api/admin/rooms/:id
- **Branch**: `claude/v0.2-implementation-handoff-ZapvB`
- **Date**: 2026-05-23
- **Status**: open, awaiting CI

### Product decision captured

Room **detail/settings** stays **SYSTEM_ADMIN-only** for now (`GET`/`PATCH`/
`archive`/`restore`/`DELETE /api/admin/rooms/:id` keep their `isSystemAdmin`
guard — no API change). May open to ROOM_ADMIN later, not in v0.2. This is the
answer to the prior PR's open question. Recorded in ROADMAP §2 Milestone D.

### What changed

- **`src/app/admin/rooms/[roomId]/settings/page.tsx` rewired**: drops the
  `DEFAULT_SETTINGS` seed as live state. Loads via `GET
  /api/admin/rooms/:id` (loading + 403 + error states; a non-system-admin
  sees "システム管理者のみ利用できます"). Save issues `PATCH` with the
  basic fields (name/description/kind/expiresAt), visibility
  (watchingPublic/rankingPublic via PUBLIC↔MEMBERS_ONLY↔DISABLED mapping,
  replayShareEnabled), and the rule/coding/items bundled into
  `rulePreset`. Archive/restore/delete call their real endpoints
  (delete prompts for the room number, then redirects to the rooms list).
- **rulePreset round-trips but is simulator-inert**: board size, AP,
  items, coding limits save into `Room.rulePreset` and reload correctly,
  but the simulator still uses fixed defaults (post-v0.2 "simulator
  depth"). The visibility + basic-info + lifecycle parts take effect
  immediately.
- `DEFAULT_SETTINGS` is retained only as the fallback for empty
  `rulePreset` fields (and "reset rules" button).

### Next 1–3 PRs (recommended order)

1. **Admin write actions** (ROADMAP Milestone D). Wire the modals that
   are still UI-only to existing endpoints: member issue/reissue/disable
   (`POST`/`PATCH /api/admin/rooms/:id/members[/:mid]`), room
   create/delete/archive, and account invite/disable/reset on the users
   page. **Match-cancel needs a new endpoint** (`MATCH_CANCEL` audit
   action exists, route doesn't) — build it as part of this.
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
