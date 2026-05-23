# Roadmap — toward v0.2 完成

This document defines **what "done" means for v0.2** and the milestones to get
there. It complements the other two docs:

- `docs/HANDOFF.md` — the durable implementation record (what's built, design
  decisions, the prioritized backlog in section 4).
- `docs/STATUS.md` — the rolling per-push log (latest PR, next 1–3 PRs).

This roadmap is the **medium-term map** that sits between them: it groups the
backlog into milestones and states the completion criteria so any agent
(Claude / Codex) or human can see how close v0.2 is and what's left.

> ⚠️ **Draft — pending product confirmation.** The milestones and "definition
> of done" below are inferred from the 17 prototypes in `project/*.html`, the
> Prisma schema, and the existing HANDOFF backlog. They have **not** been
> ratified against a written product spec. Treat the scope lines marked
> **(TBD)** as open questions for the product owner before building.

---

## 1. Definition of done (v0.2)

v0.2 is "complete" when a teacher can run a classroom and students can play
real matches end-to-end, with no mock data on the critical player and
spectator paths. Concretely:

1. **Auth & access** — all four roles log in; room access is enforced
   (membership / public-lobby / admin). ✅ *Done.*
2. **Play a match end-to-end** — two students enter a match, each builds a
   *real* strategy in the block editor, locks it, the server simulates the
   turns, both watch the battle replay, and land on a result screen with real
   stats. ⏳ *Blocked only on the Blockly → strategy serializer.*
3. **Spectate** — a third party can watch a match live with the delayed
   board, player panels, and result. ⏳ *Live data wired; UI cleanup pending.*
4. **Room hub** — a student opens a room and sees its real matches, standings,
   and announcements. ⏳ *Hero done; lists pending.*
5. **Admin operations** — a room admin manages members, issues codes, schedules
   matches, and reviews the audit log against real data. ⏳ *Pages exist on
   mocks; APIs largely exist.*
6. **Quality bar** — `tsc`, ESLint, `npm test`, and `next build` all green in
   CI on every PR. ✅ *Done (PR #4, #10).*

Anything not in this list is **post-v0.2** (see section 4).

---

## 2. Milestones

Status legend: ✅ done · 🟡 in progress · ⬜ not started

### Milestone A — Core match loop (the heart of the game)

| Item | Status | Notes |
| :--- | :----- | :---- |
| Login / signup / session | ✅ | `src/lib/auth.ts`, cookie sessions |
| Coding page header (room / opponent) | ✅ | PR #8 |
| Lock strategy → `match_started` | ✅ | `server.ts` `coding_lock` handler |
| Turn simulator (server-side) | ✅ | PR #5, `src/lib/match-simulator.ts` |
| Battle replay (live `turn_event`) | ✅ | PR #5 |
| Result screen (real stats) | ✅ | PR #7 |
| **Blockly → strategy JSON serializer** | ⬜ | **The one remaining blocker for A.** Coding page still submits `MOCK_STRATEGY_JSON`. Until this lands, both players always run the same stub strategy. |
| Coding `lastTurn` tab real data | ⬜ | Needs simulator to surface prior-turn perception OR a `/api/match/:id/lastTurn` endpoint **(TBD which)** |

**A is done when** two students can build different strategies and the
simulation reflects them.

### Milestone B — Spectator experience

| Item | Status | Notes |
| :--- | :----- | :---- |
| Watch page live board / panels | ✅ | PR #9 |
| Watch header (room / players) | ✅ | PR #9 |
| Obstacles / items on board | ⬜ | Depends on simulator modelling them (post-v0.2? **TBD**) |
| Timeline event ticks | 🟡 | Mocked; derive from replay once events exist |
| Viewer count (real) | ⬜ | Needs Socket.io room introspection **(TBD scope)** |
| Live commentary feed | ⬜ | No backing feature; likely **post-v0.2** |
| Remove design-only "state gallery" | ⬜ | Bottom of watch page is a 6-card design showcase; shouldn't ship |

**B is done when** the watch page shows only real data and the design-gallery
scaffolding is gone.

### Milestone C — Room hub

| Item | Status | Notes |
| :--- | :----- | :---- |
| Room hero (name / kind / members / expiry) | ✅ | PR #11 |
| Matches list in room | ✅ | PR #12 — wired to `/api/rooms/:n/matches` |
| Standings (top 5) | ✅ | PR #12 — wired to `/api/rooms/:n/standings` |
| "Your record" | ✅ | PR #12 — derived from standings (my entry) |
| "Your schedule" | ⬜ | Still mock; needs a schedule source **(TBD)** |
| Announcements | ⬜ | `Announcement` model exists; no API yet |

**C is done when** the schedule has a source and announcements have an API.

### Milestone D — Admin operations

| Item | Status | Notes |
| :--- | :----- | :---- |
| Admin API routes (users / rooms / members / audit) | ✅ | Implemented (HANDOFF §1) |
| System users page | ✅ | PR #14 — `/api/admin/users` (server filter + pagination) |
| System rooms page | ✅ | PR #15 — `/api/admin/rooms` (server filter + pagination + status counts) |
| System audit page | ✅ | PR #16 — `/api/admin/audit` (cursor pagination; category/type filtered client-side) |
| Room overview page | ✅ | PR #16 — `/api/admin/rooms/:id` + matches/standings (today-matches & activity still mock) |
| Room members page | ✅ | PR #17 — `/api/admin/rooms/:id/members` + standings for W/L/D |
| Room matches page (LIST) | ✅ | PR #18 — `/api/admin/rooms/:id/matches`; bracket views still mock |
| Room standings page | ⬜ | Needs damage/turns/recent aggregation the standings API doesn't expose — enriched endpoint first |
| Room settings page | ✅ | PR #19 — GET/PATCH /api/admin/rooms/:id + archive/restore/delete (SYSTEM_ADMIN-only, per product decision) |
| Invite-code validation on signup | ⬜ | HANDOFF §4.4 — needs `InviteCode` model (schema change) |
| Member write actions (issue / reissue / disable) | ✅ | PR #20 — members page wired to existing POST/PATCH endpoints |
| Other write actions (room create / account invite·disable·reset / cancel-match) | ⬜ | Modals exist but not all wired; match-cancel endpoint missing |

**Decision (2026-05-23):** Room **detail/settings** (`GET`/`PATCH`/`archive`/
`restore`/`DELETE /api/admin/rooms/:id`) stays **SYSTEM_ADMIN-only** for now.
May open to ROOM_ADMIN later, but not in v0.2. Member-composition and
match-card management *are* already ROOM_ADMIN-capable (their endpoints use
the `isAdmin` + own-room guard).

**D is done when** an admin can manage a room without seeing any mock data.

### Milestone E — Production readiness

| Item | Status | Notes |
| :--- | :----- | :---- |
| CI (lint / type / test / build) | ✅ | PR #4, #10 |
| Simulator unit tests | ✅ | PR #10 |
| `src/lib/auth.ts` unit tests | ✅ | PR #13 — 15 cases (token round-trip, role guards, getSession branches) |
| Email confirmation on signup | ⬜ | HANDOFF §4.4 |
| 2FA enable/verify flow | ⬜ | Schema has `twoFactorEnabled`; no flow **(TBD if in v0.2)** |
| Dependency cleanup (`next-auth` unused) | ⬜ | HANDOFF design note #5 |

**E is done when** the quality bar holds and auth has test coverage; email/2FA
scope is **TBD**.

---

## 3. Current snapshot (2026-05-23)

- **Merged**: PR #4 (CI), #5 (simulator), #6 (stats aggregation), #7 (result
  page + shared docs), #8 (coding header), #9 (watch page), #10 (Vitest),
  #11 (rooms hero + this roadmap).
- **Open**: PR #12 (rooms matches + standings).
- **Critical path to v0.2**: the **Blockly → strategy serializer (Milestone
  A)** is the single highest-leverage piece — it's the last thing standing
  between "the simulator runs" and "students actually compete." It needs a
  product call on the editor approach (real Blockly integration vs. a
  lightweight rule-builder) before building — flagged in STATUS open
  questions.

---

## 4. Out of scope for v0.2 (post-v0.2 backlog)

Captured here so they're not silently pulled into v0.2:

- **Simulator depth**: AP budget enforcement, obstacles, items
  (CROSS / BARRIER / REPEAT), multi-action turns. The `TurnSnapshot` wire
  format is designed to extend additively (HANDOFF decision #9), so these
  can land without breaking the client.
- **Live commentary** during spectating.
- **Real-time room ranking** recomputed on each match end (vs. on-demand
  aggregation today).
- **Mobile-optimized layouts** (prototypes are desktop-first).
- **Replay sharing / social** beyond the existing share link.

---

## 5. How to keep this current

- When a milestone item flips state, update its row here **and** the relevant
  HANDOFF §4 entry.
- When you finish a milestone, note it in `docs/STATUS.md` "Latest".
- If product answers any **(TBD)** above, replace the marker with the decision
  and date so the next agent doesn't re-litigate it.
