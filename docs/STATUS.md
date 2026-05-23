# Status

Rolling cross-agent status report shared between Claude Code and Codex.
Updated on every push. See `AGENTS.md` for the workflow expectations.

When you push, do these three things in `docs/STATUS.md`:

1. Move the current "Latest" block into "History" (one-line summary).
2. Replace "Latest" with the new PR's details.
3. Refresh "Next 1–3 PRs" and "Open questions" if anything changed.

---

## Latest

- **PR**: #13 — test(auth): unit tests for src/lib/auth.ts
- **Branch**: `claude/v0.2-implementation-handoff-ZapvB`
- **Date**: 2026-05-23
- **Status**: open, awaiting CI

### What changed

- **`src/lib/auth.test.ts`**: 15 unit tests, total suite now 24.
  - `createSessionToken` — base64 round-trip recovers the user id,
    includes a timestamp segment, distinct per user.
  - `isAdmin` / `isSystemAdmin` — table-driven across all four roles.
  - `getSession` — branches with `next/headers` `cookies()` and the
    Prisma client mocked via `vi.mock`: no cookie → null (no DB call);
    valid token → active user with the lookup scoped to
    `{ id, status: "ACTIVE" }`; user not found → null; DB throws → null
    (the try/catch swallows it).
- Mocking pattern: `vi.mock("next/headers", …)` and
  `vi.mock("./db", …)` with per-test `mockResolvedValue` /
  `mockRejectedValue`. Useful template for testing other server modules
  that touch cookies + Prisma.
- ROADMAP Milestone E row for auth tests flipped to ✅.

### Next 1–3 PRs (recommended order)

1. **Admin pages mock removal** (ROADMAP Milestone D). The
   `/api/admin/*` routes already exist; the system + room admin pages
   render on inline mocks. Mechanical, several pages — can be split per
   page. Recommend starting with `/admin/system/users` (wire to
   `GET /api/admin/users`).
2. **Blockly → strategy JSON serializer** (ROADMAP Milestone A, the
   critical-path blocker). Needs a product call first: real Blockly
   integration vs. a lightweight rule-builder. Once decided, this is
   the highest-leverage piece — it's what makes two players actually
   compete with different strategies.
3. **API route handler tests.** With the `vi.mock` cookies+Prisma
   pattern from PR #13 established, the `/api/match/*` and `/api/rooms/*`
   handlers (especially the access-control branches) are now
   straightforward to cover.

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
