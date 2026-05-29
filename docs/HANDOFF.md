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
| `/rooms`                                  | Minimal room-picker index (no prototype)  |
| `/rooms/[roomNumber]`                     | `project/room-top.html`                   |
| `/practice`                               | Solo practice battle (no prototype)      |
| `/match/[matchId]/coding`                 | `project/match-coding.html`               |
| `/match/[matchId]/battle`                 | `project/match-battle.html`               |
| `/match/[matchId]/result`                 | `project/match-result.html`               |
| `/watch/[matchId]`                        | `project/match-watch.html`                |
| `/admin`                                  | Role-aware redirect landing               |
| `/admin/system`                           | Redirect to `/admin/system/rooms`         |
| `/admin/system/rooms`                     | `project/admin-system-rooms.html`         |
| `/admin/system/users`                     | `project/admin-system-users.html`         |
| `/admin/system/audit`                     | `project/admin-system-audit.html`         |
| `/admin/system/settings`                  | Minimal準備中 placeholder (no prototype) |
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
/api/practice/simulate                  POST   — standalone solo bot simulation
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
/api/admin/rooms/[id]/activity          GET
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
11. **`src/proxy.ts` is the Next 16 edge auth guard (optimistic).** It
   redirects session-cookie-less requests to `/login` for `/dashboard`,
   `/rooms`, `/match`, `/admin` (PR #51). It only checks cookie *presence* —
   real validation stays in `getSession` per route/page. **`/watch` is
   deliberately excluded from the matcher**: public spectating is anonymous
   (`/api/match/:id/public` is "no auth required", gated by `isPublicWatch` /
   `watchingPublic`), so do not add `/watch/:path*` back to the matcher.
   **The Socket.io handshake (`server.ts` `io.use`) likewise allows anonymous
   read-only sockets** so `/watch` gets live `turn_event` / `viewer_count`
   without a login; write events still require `socket.data.userId`
   (`coding_lock` no-ops for anonymous). Earlier the handshake rejected
   cookie-less sockets, which silently broke anonymous spectating despite the
   route being public — fixed so the two layers agree.
   Related PR #51 auth fixes: the session cookie is `secure` only when the
   app URL is HTTPS (so prod-over-HTTP localhost login works), and the logout
   `<Link>`s use `prefetch={false}` (prefetch was silently hitting the
   destructive `/api/auth/logout`).
12. **Navigation landing routes stay thin.** The nav audit added
   `docs/NAV_AUDIT.md` and keeps contentless landings as redirects:
   `/admin/system` → `/admin/system/rooms`, `/admin` → role-aware admin or
   dashboard destination. Feature routes without a v0.2 implementation
   (`/admin/system/settings`) use minimal準備中 pages with existing
   chrome rather than inventing product UI or removing visible nav affordances.
   Dashboard replay links use `/watch/[matchId]`; there is no `/replay/[id]`
   page.
13. **Login is role-aware, enforced server-side (PR #62 + #63).** After a
   successful login the client redirects on `data.user.role`: SYSTEM_ADMIN /
   ROOM_ADMIN → `/admin`, everyone else → `/dashboard`. `/dashboard` stays the
   *player* home (the prototype is ROOM_USER-shaped and has no admin
   affordance), so admins should not be parked there. The client redirect is
   only the fast path — a **server guard** (`src/app/dashboard/layout.tsx`)
   bounces any admin who reaches `/dashboard` anyway (stale bundle, the brand
   logo's `/dashboard` link, direct visit). The landing rule lives in one place,
   `adminLandingPath(session)` in `src/lib/admin-landing.ts`, used by both the
   dashboard guard and `/admin` (`src/app/admin/page.tsx`): SYSTEM_ADMIN →
   `/admin/system/rooms`, ROOM_ADMIN → first assigned non-deleted room, else
   `null` (non-admin / room admin with no room → stays on `/dashboard`, so
   there is no redirect loop).
14. **Practice mode is standalone and non-persistent.** `/practice` is now a
   logged-in solo battle surface: the client reuses the real Blockly editor and
   serializer, posts `{ strategy, difficulty }` to
   `POST /api/practice/simulate`, and replays the returned simulator turns
   locally. The API selects a built-in bot and calls the pure
   `simulate(userStrategy, botStrategy, { maxTurns: MAX_TURNS })`. It does
   **not** create `Match` records, open Socket.io, write stats, or affect room
   standings. `/practice` is included in the optimistic proxy matcher, and the
   API also requires `getSession()`.
15. **Strategy block language is composable; the simulator uses a
   relative-direction model (PR #66).** The Blockly palette is being rebuilt
   into categories of individual blocks (see the requested mockups). Landed so
   far: **行動** (10 action statement blocks), **状態確認** (4 boolean value
   blocks), **敵情報** (1 boolean `敵を検出している？` → `scan_detected`, plus
   3 Number readouts `敵の前方/右方向距離`・`敵までの距離` that are palette-only until
   comparisons land), **前回結果** (`前回ダメージを受けた？` → `damaged`,
   `前回敵に命中した？` → `shot_hit`, a perception flag set when last turn's shot
   landed a HIT), and **自機情報** (`自分のHP`・`残りターン` Number readouts +
   `自分の向き` and the `上/右/下/左` Direction constants), and **制御** — now just
   the `もし` if-block (the `繰り返す` repeat-block was **removed**). `もし` is
   **functional**: it nests in a rule's 「実行」 stack and conditionally runs its
   body (see decision #18). **論理・比較** (PR — comparison
   `=/≠/<≤/>≥`, `かつ/または`, `ではない`, `true/false`) is **functional**: it
   wires the accumulated value blocks into evaluable conditions (see decision
   #16). A `tank_rule` is `もし <Boolean value>` + `実行 <statement body>`;
   `tank_rule_always` is the conditionless `ルール` variant and serializes
   to an always-matching rule (`conditions: []`). `tank_fallback` remains
   readable for old saved workspaces but is no longer
   exposed in the toolbox; when no rule matches and no fallback is present, the
   serializer/simulator uses `WAIT`. The serializer emits the `Strategy` JSON
   the simulator consumes (`rules[].{conditions, body}` + optional legacy
   `fallbackBody`; legacy `actions`/`sets` still execute — decision #18), so the
   simulator / real-match flow are structurally unchanged. **Simulator
   semantics**: P1 starts from the lower-left cell facing north and P2 starts
   from the upper-right cell facing south. Board row labels are player-facing:
   bottom-to-top is `1` through `10`, with columns still `A` through `J`. Move
   and shoot are **relative to facing** (FORWARD/BACK/LEFT/RIGHT). A successful
   move updates the player's facing to the absolute direction moved; blocked
   moves leave facing unchanged.
   `SCAN_AROUND` detects in all four directions within range. New conditions
   `can_move_{forward,back,left,right}` report whether that relative cell is in
   bounds and unoccupied. **数値・変数** (number literal, arithmetic `+−×÷`,
   `÷ の余り` modulo, variable read `項目`, and `項目 に … をセット`) is the **last
   mockup category — the palette rebuild is complete** and wired (see decision
   #17). **Every palette block is now functional** — there are no remaining
   palette-only/mock blocks.
16. **論理・比較 conditions are a boolean expression tree; enemy metrics are
   omniscient (PR).** A rule's `もし` is serialized into one condition node, now
   recursive: legacy named checks keep the flat `{type, value}` leaf shape, and
   the logic blocks add `{type:"and"|"or", args:[…]}`, `{type:"not", arg}`,
   `{type:"bool", value}`, and `{type:"compare", cmp, left, right}`. A `compare`
   reads two **value nodes** — a `{type:"num", value}` literal, a
   `{type:"dir", dir}` direction constant, or a perception **metric**
   (`enemy_distance`/`enemy_forward_distance`/`enemy_right_distance`, `self_hp`,
   `turns_left`, `self_facing`). Enemy distance metrics are computed from
   **ground-truth** opponent position (Manhattan for `enemy_distance`; signed
   forward/right projections relative to facing) — consistent with the simulator
   already being omniscient for `can_move_*` and shooting; scanning stays useful
   only for the `scan_detected` flag. `EQ/NEQ` work on numbers or directions;
   `LT/GT/LTE/GTE` require numbers. Unresolved operands fail closed (condition
   false). The same node shapes are validated server-side in
   `/api/practice/simulate` (recursive `isValidCondition`/`isValidValue`) — that
   route's allow-list previously also rejected `shot_hit`, now fixed.
17. **数値・変数 extends the value tree and adds a per-player variable store
   (PR).** Value nodes gained `{type:"num", value}` (literal),
   `{type:"arith", op:ADD|SUB|MUL|DIV, left, right}`, `{type:"mod", left, right}`
   (DIV/MOD by zero → null = fail closed), and `{type:"var", name}` (reads the
   player's variable, **unset = 0**). **Variables** are stored per player in a
   `Vars` dict that **persists across turns** (`vars1`/`vars2` in `simulate`).
   The `項目 に … をセット` block is a **statement** that snaps into a rule's 「実行」
   stack; the serializer's `collectSets` captures the set-statements that appear
   **before the first action** (sets after it never run, since the turn ends at
   the action). **Execution model**: `chooseAction` walks rules top-down; a
   matched rule applies its sets (in order) and, if it yields a valid action,
   that action wins — a **set-only matched rule applies its sets and falls
   through**, so later rules/conditions see the updated variables. The fallback
   may also carry `fallbackSets`. Variable names come from Blockly's
   `field_variable` (read via `getField("VAR").getText()`). Server-side
   validation covers the new value nodes and `sets`/`fallbackSets`.
18. **Rule 「実行」 is an ordered statement body; the 制御 `もし` block is wired,
   and `繰り返す` was removed (PR).** A rule's body is now serialized as
   `body: StrategyStmt[]` (and the fallback as `fallbackBody`), replacing the
   earlier flat `actions`+`sets`. A statement is `{kind:"action", type}`,
   `{kind:"set", name, value}`, or `{kind:"if", cond, body}` (the 制御 `もし`
   block; its 「実行」 is collected recursively). **Execution** (`runBody`): walk
   in order — `set` mutates a variable; `if` descends into its nested body only
   when `cond` is true; the **first `action` reached wins** and ends the turn.
   A matched rule that produces no action **falls through** (its variable writes
   persist), as before. The simulator keeps a **legacy path**: rules/fallbacks
   carrying the old `actions`/`sets` (stored strategies, the built-in bots, older
   tests) still run via `runLegacy` (apply sets, take first action). The server
   API validates `body`/`fallbackBody` recursively (`isValidStmt`). The `繰り返す`
   loop block was **deleted** (no sequential-program model to give it meaning);
   with `もし` wired, **no palette block is mock-only anymore**. A genuine loop
   would still need a bounded-iteration model — out of scope for now.
   **Restyle (later PR):** the `もし` block is **slate-blue** (`#5b6b8c`) and now
   reuses Blockly's built-in **`controls_if_mutator`** (the gear) so players can
   add **else-if (そうでなければもし) and else (そうでなければ)** branches —
   relabeled to Japanese via `Blockly.Msg.CONTROLS_IF_MSG_*`, inputs `IF0/DO0`,
   `IF1/DO1`…, `ELSE`, prev/next constrained to `Action`. The `if` statement node
   gained `clauses: [{cond, body}, …]` (clauses[0]=if, rest=else-if) + optional
   `else`; `runBody` runs the first true clause and **does not** run `else` if any
   clause matched. The legacy single-branch `{cond, body}` shape still works.
   Per a product call, **action block labels stay Japanese-only** (no English
   command suffix).
19. **Battle action feedback is derived client-side from `TurnSnapshot`.**
   `src/components/battle/ActionEffects.tsx` renders the shared visual feedback
   used by `/practice`, `/match/:id/battle`, and `/watch/:id`: round projectile
   shots along the relative shoot ray until they hit the enemy, an obstacle, or
   the board edge; comic-style hit bursts; scan-range coloring; and
   blocked-move bump labels. `/match/:id/battle` and `/watch/:id` pass their
   visible obstacle coordinates into the effect renderer so projectile visuals
   stop on obstacles before targets. The simulator wire shape was kept
   unchanged; the component derives effects from existing fields (`action`,
   `moved`, `shoot_result`, `scan_detected`, position/facing). Live battle/watch
   pages intentionally keep **received turns** separate from the **displayed
   turn** so the next turn is not shown until the current action effect has
   cleared. Simulator shooting now uses line-of-sight to the board edge
   (`GRID_SIZE - 1`) rather than the scan range; true obstacle blocking is still
   only visual because obstacles are not yet part of `match-simulator.ts`.

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
   (PR #23, see decision #10). Still on mocks / placeholders: the coding
   page's `lastTurn` tab; the watch page's obstacles / items / commentary
   feed. The watch page's **viewer count + timeline** are now real-data
   (socket presence + turn/replay-derived ticks, PR #34); the dev
   state-gallery was removed (PR #27). The rooms page's **"your schedule"**
   is API-derived from matches+me (PR #44, interim definition: own active
   matches by `codingDeadlineAt`), and **announcements** are API-wired
   (PR #28/#31). The matches-page **tournament view** (`TournamentView`) is a
   round-grouped real-match list (PR #29) — a true bracket *tree* still needs
   match-to-match advancement linkage the schema lacks. The create-match
   modal (PR #25) and the **round-robin / head-to-head** view (PR #26,
   `RoundRobinView`) are wired to real match data. The system **users**
   (PR #14),
   **rooms** (PR #15), **audit** (PR #16) pages and the room
   **overview** (PR #16) + **members** (PR #17) + **matches LIST** (PR #18)
   + **settings** (PR #19) + **standings** (PR #24, enriched endpoint with
   avg dmg / turns / recent form + summary) pages are wired to
   `/api/admin/*`. Room overview activity feed is now real-data via
   `/api/admin/rooms/:id/activity` (AuditLog-based). **Admin write actions are
   now fully wired**: room members issue/reissue/disable (PR #20), system
   rooms create/delete/archive·restore + system users
   invite/disable/reset (PR #21), and match-cancel (PR #22). Note: room
   settings writes remain **SYSTEM_ADMIN-only** by product decision
   (2026-05-23) — see ROADMAP §2 Milestone D. The room overview GET permits
   assigned `ROOM_ADMIN` so `/admin` can land on the assigned room overview.
4. **TODOs flagged in routes:**
   - `src/app/api/auth/signup/route.ts:61` — validate invite codes against a
     future `InviteCode` model (schema change required)
   - `src/app/api/auth/signup/route.ts:77` and
     `src/app/api/auth/signup/promote/route.ts:95` — send confirmation email
5. **Test coverage is growing (149 unit/route cases + Scope-A/Nav/Scope-B/practice E2E smoke).** Vitest is wired up (PR #10).
   Unit tests: `src/lib/match-simulator.ts` (incl. `maxTurns` options +
   `normalizeMaxTurns`), `src/lib/auth.ts` (PR #13),
   `src/lib/strategy-blocks.ts` (jsdom — Blockly→Strategy serializer),
   `src/lib/coding-timer.ts` (PR #42), `src/lib/room-schedule.ts` (PR #44).
   Route-handler tests now cover the **whole API surface** by mocking
   `@/lib/auth` / `@/lib/db` / `@/lib/audit` (a `vitest.config.ts` `@`→`src`
   alias makes routes importable):
   - admin: cancel + standings (PR #30), matches POST + users PATCH (PR #32),
     members issue/disable/reissue + users invite/force-reset (PR #36),
     rooms create/delete/archive·restore + activity feed (PR #38);
   - player read: `rooms/:n` + matches/standings, `me/stats`, `me/matches`
     (PR #46);
   - match read: `match/:id/{public,state,result,replay}` (PR #48);
   - practice: `practice/simulate` validates logged-in standalone bot
     simulations.
   Playwright E2E Scope A is now wired under `e2e/**/*.spec.ts` with
   `playwright.config.ts`: seed-account login → dashboard role smoke,
   unauthenticated protected-page redirect to `/login`, and seeded student
   room-page smoke. The nav smoke additionally clicks dashboard→rooms→room→
   coding, `/practice`, dashboard replay→watch, system-admin sidenav entries,
   `/admin` role redirects, and error-page admin buttons to prevent 404
   regressions. Scope B now adds a realtime multi-context smoke: taro/hanako
   log in separately, derive the seeded CODING match id through the room
   "入室する" flow, lock code, auto-transition to battle, click the result link,
   and verify a watcher context increases `/watch/[matchId]` viewer count.
   The practice smoke logs in, opens `/practice`, starts a solo bot battle, and
   waits for replay result controls.
6. **Ruleset simulation note updated.** PR #19 left `rulePreset` as
   round-trip but simulator-inert; PR #39 wires `rulePreset.maxTurns` into
   live `simulate(...)` runs (`coding_lock` → `runMatch`) with defensive JSON
   parsing. Other ruleset fields (`ap`, `obstacles`, `items`) remain
   intentionally post-v0.2.
7. ~~CI is not set up.~~ **Done.** `.github/workflows/ci.yml` runs lint,
   `tsc --noEmit`, and `next build` on every PR (PR #4).

## 5. How to run

```bash
docker compose up -d                 # Postgres on 127.0.0.1:5432
cp .env.example .env                 # required; prisma reads DATABASE_URL from it
npm install                          # postinstall runs `prisma generate`
npm run db:push && npm run db:seed
npm run dev                          # http://localhost:3000
```

Playwright smoke (Scope A + navigation + Scope B) runs against a production
build and requires the same Postgres seed data:

```bash
docker compose up -d postgres
cp -n .env.example .env
npm run db:push && npm run db:seed
npm run build
npx playwright install --with-deps chromium
npm run test:e2e
```

`playwright.config.ts` starts `npm run start` via `webServer` on
`http://localhost:3000` and reuses an already-running local server outside CI.
Scope B consumes the seeded CODING match by driving it to FINISHED, so run
`npm run db:seed` before each local E2E rerun.

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
