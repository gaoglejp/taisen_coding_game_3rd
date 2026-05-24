# Handoff — v0.2 UI prototype implementation

This document is written for the next Claude (or human) session that picks up
this repository. The previous session implemented v0.2 from a design handoff
bundle, but could not push from its container, so this file is the *only*
durable record of what was done, what works, and what is intentionally
unfinished. Read it before making changes.

Previous session URL (may be inaccessible): `https://claude.ai/code/session_016Zpat22zYswrKq8Lr5JndY`

---

## 1. Where we are

The `project/` directory contains 17 static HTML/CSS prototypes that are the
**visual source of truth**. The previous session converted each prototype into
a working Next.js page, wired up the corresponding API route handlers, defined
the Prisma schema and seed, and mounted Socket.io on the same port as Next via
a custom `server.ts`.

The app **boots, every page returns 200, `tsc --noEmit` is clean, ESLint passes
with no warnings**. It is *not* yet end-to-end functional: most pages render
against in-component mock data rather than the API, and Socket.io is not wired
into the client yet (the server side scaffold exists). See section 4.

### Implemented screens (file ⇄ design)

| Page route                                | Source prototype                          |
| :---------------------------------------- | :---------------------------------------- |
| `/login`                                  | `project/login.html`                      |
| `/signup`                                 | `project/signup.html`                     |
| `/dashboard`                              | `project/dashboard.html`                  |
| `/rooms/[roomNumber]`                     | `project/room-top.html`                   |
| `/match/[matchId]/coding`                 | `project/match-coding.html`               |
| `/match/[matchId]/battle`                 | `project/match-battle.html`               |
| `/match/[matchId]/result`                 | `project/match-result.html`               |
| `/watch/[matchId]`                        | `project/match-watch.html`                |
| `/admin/system/rooms`                     | `project/admin-system-rooms.html`         |
| `/admin/system/users`                     | `project/admin-system-users.html`         |
| `/admin/system/audit`                     | `project/admin-system-audit.html`         |
| `/admin/rooms/[roomId]`                   | `project/admin-room-overview.html`        |
| `/admin/rooms/[roomId]/members`           | `project/admin-room-members.html`         |
| `/admin/rooms/[roomId]/matches`           | `project/admin-room-matches.html`         |
| `/admin/rooms/[roomId]/standings`         | `project/admin-room-standings.html`       |
| `/admin/rooms/[roomId]/settings`          | `project/admin-room-settings.html`        |
| `/error/[code]` (404 / 403 / 500 / maintenance / ws) | `project/errors.html`          |

### Implemented API routes

All routes use `src/lib/db.ts` (Prisma client) and `src/lib/auth.ts`
(cookie session helpers). Audit-relevant writes call `src/lib/audit.ts`.

```
/api/auth/{login,logout,signup,signup/promote}
/api/me                                 GET    — current session user
/api/me/stats                           GET    — TODO: real aggregation (see route file)
/api/me/matches                         GET
/api/rooms/visible                      GET
/api/rooms/[roomNumber]                 GET
/api/rooms/[roomNumber]/matches         GET
/api/rooms/[roomNumber]/standings       GET
/api/match/[matchId]/public             GET
/api/match/[matchId]/state              GET
/api/match/[matchId]/result             GET
/api/match/[matchId]/replay             GET
/api/socket                             — (Socket.io path, served by server.ts)

/api/admin/audit                        GET
/api/admin/users                        GET   POST
/api/admin/users/[id]                   GET   PATCH   DELETE
/api/admin/users/[id]/force-password-reset    POST
/api/admin/users/invite                       POST
/api/admin/rooms                        GET   POST
/api/admin/rooms/[id]                   GET   PATCH   DELETE
/api/admin/rooms/[id]/archive           POST
/api/admin/rooms/[id]/restore           POST
/api/admin/rooms/[id]/members           GET   POST
/api/admin/rooms/[id]/members/[mid]     PATCH   DELETE
/api/admin/rooms/[id]/members/[mid]/reissue   POST
/api/admin/rooms/[id]/matches           GET   POST
/api/admin/rooms/[id]/matches/[matchId]/cancel   POST
/api/admin/rooms/[id]/standings         GET
```

Note: the spec talked about `/admin/api/*` as a separate namespace; we collapsed
it under `/api/admin/*` because they share auth + audit code and Next.js gives
us nothing for the namespace split. See the route guards in `src/lib/auth.ts`.

### Shared layout primitives

- `TopbarPaper` — warm-paper player chrome (used by every non-admin page)
- `TopbarAdmin` — dark-purple system-admin / dark-teal room-admin chrome
- `AdminSidenav` — left nav for admin sections; takes `scope: "system" | "room"`
- `ScopeBanner` — the "対戦の具体操作はできません" banner shown when an admin
  views (but cannot operate) a match. Imposes the role-aware guardrail in one
  place; do not inline this text elsewhere.

### Database

`prisma/schema.prisma` defines the four roles, classrooms, members,
match sessions, and audit events. `prisma/seed.ts` creates one of each role,
one classroom, and one finished match so the dashboard isn't empty after seed.

Default seed accounts (all `password123!`):
- `sysadmin` — SYSTEM_ADMIN
- `teacher01` — ROOM_ADMIN
- `taro_student`, `hanako_student` — ROOM_USER

---

## 2. Verified working

As of the previous session's last run:

- `npm run dev` boots Next + Socket.io on port 3000
- Every implemented page returns HTTP 200 (manually walked)
- `npx tsc --noEmit` — clean
- `npm run lint` — clean
- `prisma db push` + `prisma db seed` — succeed against the docker-compose
  Postgres
- All 4 roles can log in via `/login` and see their role-appropriate dashboard

## 3. Important design decisions (why, not what)

These are the calls the previous session made that the next session should
*not* silently undo:

1. **Custom `server.ts` instead of API-route-based Socket.io.** Next 16's route
   handlers cannot hold a long-lived `Server` instance across hot reloads, and
   `app.prepare()` is the only way to share the HTTP server with Socket.io.
   `npm run dev` uses `tsx watch server.ts`; do not switch back to `next dev`.
2. **Inline styles + Tailwind v4 tokens, no Material UI.** The design uses
   warm-paper / dark-purple / dark-teal palettes that don't map onto MUI's
   theme. Each prototype's CSS was lifted into the corresponding React file as
   inline `style={}` or `className=` with Tailwind utility classes.
3. **Role-aware chrome at the layout level.** The two `Topbar*` components and
   `ScopeBanner` are the *only* place where role logic affects chrome. Do not
   put role checks in individual pages — push them up to layout.
4. **`/api/admin/*` (not `/admin/api/*`).** See the namespace note above.
5. **Cookie sessions with bcrypt, not NextAuth.** `next-auth` is in
   `package.json` from an earlier exploration but is not used; `src/lib/auth.ts`
   implements signed-cookie sessions directly. Delete `next-auth` if you do a
   dep cleanup pass.
6. **Mock data lives inside the page that needs it.** Until the API is wired,
   pages declare their mock data as a top-level `const` so swapping to a
   `useEffect(() => fetch())` is mechanical. Don't extract into a shared mocks
   module — that delays the eventual API wiring.
7. **Strategy lives on `Match`, not a separate `MatchSession` table.** Earlier
   drafts referred to `MatchSession.strategy`; the schema actually keeps both
   players' strategies on `Match.strategy1` / `Match.strategy2` and uses
   `Match.status` (`WAITING` → `CODING` → `BATTLING` → `FINISHED`) for the
   phase transitions. There is no `MatchSession` model.
8. **Socket.io auth via the same cookie.** The Socket.io middleware in
   `server.ts` reads the `session` cookie from the handshake and decodes it
   with the same base64 scheme as `src/lib/auth.ts`. Unauthenticated sockets
   are rejected at handshake time, and `coding_lock` checks that the user is
   one of the match's two players before persisting. Keep these two auth
   paths (HTTP cookies and WS handshake) in lockstep.
9. **Simulator emits one `turn_event` per turn with a stable shape.** The
   `TurnSnapshot` type in `src/lib/match-simulator.ts` is the wire format the
   battle/watch pages consume. New rule features (AP budgets, obstacles,
   items, richer conditions) should extend the snapshot additively rather
   than replace fields, so the existing client code keeps working.
10. **Real Blockly (v12) for the strategy editor, with a custom 3-block
   language.** The coding page uses the actual `blockly` package, loaded via
   `next/dynamic({ ssr: false })` (it's DOM-only) in
   `src/components/coding/BlocklyEditor.tsx`. The block language and the
   workspace→JSON serializer live in `src/lib/strategy-blocks.ts`:
   `tank_rule` (conditions stack + one action dropdown), `tank_condition`
   (condition-type + true/false), and `tank_fallback` (one action). The
   serializer maps directly onto the simulator's `Strategy` shape — rules
   in workspace order (first match wins), conditions AND-ed, first action
   only, first `tank_fallback` → `fallbackActions`. The block field values
   are exactly the simulator's condition/action enum strings, so no
   translation layer is needed. Don't reintroduce the old hand-drawn mock
   workspace. The serializer is unit-tested (`strategy-blocks.test.ts`,
   jsdom env). The socket `coding_lock` handler still accepts an unused
   `blocklyXml`; we now pass the workspace's JSON serialization there for
   future resume/persistence (it is not yet stored).

## 4. Known unfinished work (in priority order)

1. ~~Wire Socket.io into the client.~~ **Done.** `src/lib/socket-client.ts`
   now exposes `connectSocket(matchId)` and `lockCoding(matchId, strategy)`
   helpers. The coding/battle/watch pages call `connectSocket` on mount and
   subscribe to `coding_locked`, `match_started`, `turn_event`, `match_result`.
   `server.ts` persists `Match.strategy1`/`strategy2` on `coding_lock`,
   transitions `Match.status` (`CODING` → `BATTLING`) and stamps `startedAt`
   when both players are locked, then broadcasts `match_started`. The coding
   page redirects to `/match/:id/battle` on `match_started`. Edge cases
   verified end-to-end with two browser contexts: solo lock → opponent sees
   "相手 ✓ 確定済み" pill; both lock → both redirect to battle; non-participant
   `coding_lock` returns `error_message { reason: "not_a_participant" }`;
   unauthenticated socket handshake is rejected. The battle page now consumes
   `turn_event` and `match_result` to drive HP/position/direction/turn-log —
   the previous "placeholder console" caveat is resolved by TODO 2.
2. ~~Run the turn simulation server-side.~~ **Done.** `src/lib/match-simulator.ts`
   is a pure deterministic simulator: 10×10 grid, two players, up to 20 turns,
   100 HP each, six action types (`MOVE_FORWARD`, `TURN_LEFT`, `TURN_RIGHT`,
   `SHOOT_FORWARD`, `SCAN`, `WAIT`). Strategies are evaluated rule-by-rule;
   the first matching rule's first action runs (no AP budget yet). After
   `match_started`, `server.ts` calls `simulate()`, walks the turns with a
   1.2s pacing delay, emits one `turn_event` per turn, then persists
   `Match.status=FINISHED`, `winnerId`, `endReason`, `endedAt`, and a
   `replayData = { turns, finalHp }` blob, and finally broadcasts
   `match_result`. Rich rule features (AP budget, obstacles, items, more
   conditions, target detection beyond "forward") are intentional follow-ups —
   the event shape won't change, just the data inside.
3. **Replace remaining mock data with API calls.** The battle page's HP/
   position/direction/turn-log are now live, the result page is fully wired
   (PR #7), the coding page header pulls room name / match number /
   opponent name from `/api/match/:id/state` (PR #8), the watch page
   pulls room / players from `/api/match/:id/public` and tank
   positions / HP / actions / cumulative damage from `turn_event` (PR #9),
   the rooms page hero/rules are real (PR #11), and the rooms page's
   matches list, top-5 standings, and "your record" are wired to
   `/api/rooms/:n/matches` + `/standings` (PR #12). The coding page now
   submits a **real strategy payload** — Blockly is wired to a serializer
   (PR #23, see decision #10). Still on mocks: the coding page's
   `lastTurn` tab data;
   the watch page's obstacles / items / timeline-events / commentary feed
   (placeholder) + viewer count (mock — needs presence tracking); the
   watch-page dev state-gallery was removed in PR #27. The rooms page's
   "your schedule" (still mock); announcements are now API-wired (PR #28); and the
   matches-page **tournament bracket** view (`TournamentView`) — it needs
   match-to-match advancement linkage the schema lacks, so it's blocked on
   a schema call. The create-match modal (PR #25) and the **round-robin /
   head-to-head** view (PR #26, `RoundRobinView`) are now wired to real
   match data. The system **users** (PR #14),
   **rooms** (PR #15), **audit** (PR #16) pages and the room
   **overview** (PR #16) + **members** (PR #17) + **matches LIST** (PR #18)
   + **settings** (PR #19) + **standings** (PR #24, enriched endpoint with
   avg dmg / turns / recent form + summary) pages are wired to
   `/api/admin/*`. **Admin write actions are
   now fully wired**: room members issue/reissue/disable (PR #20), system
   rooms create/delete/archive·restore + system users
   invite/disable/reset (PR #21), and match-cancel (PR #22). Note: room
   detail/settings is **SYSTEM_ADMIN-only** by product decision
   (2026-05-23) — see ROADMAP §2 Milestone D.
4. **TODOs flagged in routes:**
   - `src/app/api/auth/signup/route.ts:61` — validate invite codes against a
     future `InviteCode` model (schema change required)
   - `src/app/api/auth/signup/route.ts:77` and
     `src/app/api/auth/signup/promote/route.ts:95` — send confirmation email
5. **Test coverage is growing (37 cases).** Vitest is wired up (PR #10).
   Unit tests: `src/lib/match-simulator.ts` (9), `src/lib/auth.ts` (15,
   PR #13), `src/lib/strategy-blocks.ts` (3, jsdom — Blockly→Strategy
   serializer). Route-handler tests (PR #30): `matches/[matchId]/cancel`
   (7) and `standings` (3) — `vitest.config.ts` has an `@`→`src` alias so
   any route can now be imported + tested by mocking `@/lib/auth` /
   `@/lib/db` / `@/lib/audit`. Still missing: route tests for the other
   admin write routes (matches POST, members, users) and Playwright
   end-to-end coverage of the pages.
6. ~~CI is not set up.~~ **Done.** `.github/workflows/ci.yml` runs lint,
   `tsc --noEmit`, and `next build` on every PR (PR #4).

## 5. How to run

```bash
docker compose up -d                 # Postgres on 127.0.0.1:5432
cp .env.example .env                 # required; prisma reads DATABASE_URL from it
npm install                          # postinstall runs `prisma generate`
npm run db:push && npm run db:seed
npm run dev                          # http://localhost:3000
```

Without `.env`, `prisma db push` fails with
`Error: The datasource.url property is required in your Prisma config file`
because `prisma.config.ts` resolves `DATABASE_URL` at load time.

If `npm run dev` fails with a Socket.io port-in-use error, kill leftover `tsx`
processes (`pkill -f "tsx watch server.ts"`) and retry. This bites once per
day on average.

## 6. Gotchas

- **Prisma 7** uses the new schema/config split — `prisma.config.ts` is
  required and is in the repo. The migration commands look the same but the
  generated client lives in `node_modules/@prisma/client` only after
  `db:generate`; `db:push` alone is not enough on a fresh install.
- **Next.js 16** breaking changes vs your training data — `AGENTS.md` warns
  about this. Read `node_modules/next/dist/docs/` before assuming an API exists.
  In particular, the route-handler `Request`/`Response` types changed and
  dynamic params are `Promise<{ id: string }>` (await before use).
- **`bcryptjs`, not `bcrypt`.** The native build won't compile in some
  Anthropic cloud sandboxes; `bcryptjs` is pure JS and fine.
- **Socket.io path is `/api/socket`** (set in both `server.ts` and
  `socket-client.ts`). Changing one without the other silently breaks realtime.
- **`session_016Zpat22zYswrKq8Lr5JndY`** is in the v0.2 implementation commit
  message as a backlink to the previous session, in case someone wants to read
  the original conversation.

## 7. If you change this file

The two-file convention is:

- `CLAUDE.md` is short — it lists what to read and the few inviolable rules.
- `docs/HANDOFF.md` (this file) holds the detail.

When you finish a meaningful chunk of work, update section 4 (unfinished) and
add an entry under section 3 (decisions) if you locked in a new design call.
Keep section 1 in sync with the codebase — it's the map.
