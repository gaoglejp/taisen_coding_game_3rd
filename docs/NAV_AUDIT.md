# Navigation Audit

Scope: `src/app` and `src/components`.

Audit patterns:

- `href=`, `Link`, raw `<a href>`
- `router.push`, `router.replace`
- `redirect`
- `window.location`
- form `action`
- dynamic route literals such as `/rooms/${room.roomNumber}` and `/match/${matchId}/coding`

Result summary:

- Broken routes/auth landings found: 6
- Fixed routes/auth landings: 6 (`/admin/system`, `/admin`, `/admin/system/settings`, `/practice`, `/replay/[id]`, room-admin `/admin/rooms/[roomId]` overview API auth)
- 要判断: 0
- `/rooms` and `src/proxy.ts` `/watch` exclusion were not changed.

## Route/Parameter Rules

| Area | Route rule | Parameter source | Auth |
|---|---|---|---|
| Student room | `/rooms/[roomNumber]` | `room.roomNumber` | guarded by `src/proxy.ts`; room API checks membership/admin/public room |
| Admin room | `/admin/rooms/[roomId]` and subpages | Prisma `room.id` / URL `roomId` | guarded by proxy and room-admin/system-admin APIs |
| Match play | `/match/[matchId]/coding`, `/battle`, `/result` | Prisma `match.id` / URL `matchId` | guarded by proxy and match APIs |
| Public watch | `/watch/[matchId]` | Prisma `match.id` / URL `matchId` | intentionally not guarded by proxy; public/watch API rules apply |
| System admin | `/admin/system/*` | static | guarded by proxy; APIs require system admin where applicable |

## Navigation Matrix

| Source | Destination | Type | Route/auth/parameter verdict | Status / action |
|---|---|---|---|---|
| `src/app/page.tsx` | `/login` | `redirect()` | Existing page, public | OK |
| `src/app/login/page.tsx` | `/dashboard` | `router.push()` after login | Existing page, guarded after session cookie exists | OK |
| `src/app/login/page.tsx` | `/signup` | `Link` | Existing page, public | OK |
| `src/app/login/page.tsx` | `/error/404`, `/error/500` | `Link` | Existing dynamic error page | OK |
| `src/app/login/page.tsx` | `#` | `Link` | Local placeholder links for prototype-only footer/social/password-recovery items | OK, no route navigation |
| `src/app/signup/page.tsx` | `/login` | `Link` | Existing page, public | OK |
| `src/app/signup/page.tsx` | `#` | `Link` | Local placeholder links for prototype-only social/terms/privacy items | OK, no route navigation |
| `src/components/layout/TopbarPaper.tsx` | `/dashboard` | `Link` | Existing guarded page | OK |
| `src/components/layout/TopbarPaper.tsx` | `/api/auth/logout` | `Link` | Existing route handler redirects to `/login` | OK |
| `src/components/layout/TopbarAdmin.tsx` | `/dashboard` | `Link` | Existing guarded page | OK |
| `src/components/layout/TopbarAdmin.tsx` | `/api/auth/logout` | `Link` | Existing route handler redirects to `/login` | OK |
| `src/components/layout/AdminSidenav.tsx` | `item.href` | `Link` | Concrete menu destinations audited below | OK after fixes |
| `src/app/dashboard/page.tsx` `RoomCard` | `/rooms/${room.roomNumber}` | `Link` | Uses roomNumber for student route; `/rooms/[roomNumber]` exists | OK |
| `src/app/dashboard/page.tsx` primary CTA | `/rooms` | `Link` | `/rooms/page.tsx` exists | OK |
| `src/app/dashboard/page.tsx` practice CTA | `/practice` | `Link` | Route was missing | Fixed with minimal準備中 page |
| `src/app/dashboard/page.tsx` empty-state | `/rooms` | `Link` | `/rooms/page.tsx` exists | OK |
| `src/app/dashboard/page.tsx` recent matches | `/replay/${m.id}` | `Link` | No `/replay/[id]`; `m.id` is matchId and public replay/watch route is `/watch/[matchId]` | Fixed to `/watch/${m.id}` |
| `src/app/rooms/page.tsx` back link | `/dashboard` | `Link` | Existing guarded page | OK |
| `src/app/rooms/page.tsx` room card | `/rooms/${room.roomNumber}` | `Link` | Uses roomNumber; `/rooms/[roomNumber]` exists | OK |
| `src/app/rooms/[roomNumber]/page.tsx` error/breadcrumb | `/dashboard` | `Link` | Existing guarded page | OK |
| `src/app/rooms/[roomNumber]/page.tsx` own match | `/match/${m.id}/coding` | `Link` | Uses matchId; `/match/[matchId]/coding` exists | OK |
| `src/app/rooms/[roomNumber]/page.tsx` other match | `/watch/${m.id}` | `Link` | Uses matchId; `/watch/[matchId]` exists and remains proxy-excluded | OK |
| `src/app/rooms/[roomNumber]/page.tsx` schedule | `href={m.status === "BATTLING" ? /watch/${m.id} : /match/${m.id}/coding}` | `Link` | Both destinations exist; dynamic id is matchId | OK |
| `src/app/practice/page.tsx` | `/dashboard`, `/rooms` | `Link` | Both routes exist | Added placeholder decision: keep dashboard CTA working without building practice feature |
| `src/app/watch/[matchId]/page.tsx` | share URL `/watch/${matchId}` | computed URL | Uses matchId; current page route exists | OK |
| `src/app/watch/[matchId]/page.tsx` | Twitter intent URL | external link | External navigation, not app route | OK |
| `src/app/watch/[matchId]/page.tsx` | `#about` | anchor | Local section anchor | OK |
| `src/app/match/[matchId]/coding/page.tsx` | `/match/${matchId}/battle` | `router.push()` | Uses matchId; battle page exists | OK |
| `src/app/match/[matchId]/battle/page.tsx` | `/match/${matchId}/result` | `Link` | Uses matchId; result page exists | OK |
| `src/app/match/[matchId]/result/page.tsx` | `/dashboard` | `Link` | Existing guarded page | OK |
| `src/app/match/[matchId]/result/page.tsx` | `/match/${matchId}/coding`, `/match/${matchId}/battle` | `Link` | Uses matchId; both pages exist | OK |
| `src/app/error/[code]/page.tsx` support | `/error/500` | `Link` | Existing dynamic error page | OK |
| `src/app/error/[code]/page.tsx` primary actions | `/dashboard`, `/login`, `/error/500` | `Link` | Existing pages/routes | OK |
| `src/app/error/[code]/page.tsx` admin mini actions | `/admin` | `Link` | Route was missing | Fixed with role-aware `/admin` redirect page |
| `src/app/admin/page.tsx` | `/login` | `redirect()` | No session fallback; proxy should normally redirect first | Added |
| `src/app/admin/page.tsx` | `/admin/system/rooms` | `redirect()` | SYSTEM_ADMIN landing; route exists | Added |
| `src/app/admin/page.tsx` | `/admin/rooms/${room.id}` | `redirect()` | ROOM_ADMIN landing; uses roomId from assigned admin room | Added |
| `src/app/admin/page.tsx` | `/dashboard` | `redirect()` | Non-admin / no assigned admin room fallback | Added |
| System admin sidenav in `admin/system/rooms`, `users`, `audit`, `settings` | `/admin/system` | `Link` via `AdminSidenav` | Route was missing | Fixed with redirect to `/admin/system/rooms` |
| System admin sidenav in `admin/system/rooms`, `users`, `audit`, `settings` | `/admin/system/rooms` | `Link` via `AdminSidenav` | Existing page | OK |
| System admin sidenav in `admin/system/rooms`, `users`, `audit`, `settings` | `/admin/system/users` | `Link` via `AdminSidenav` | Existing page | OK |
| System admin sidenav in `admin/system/rooms`, `users`, `audit`, `settings` | `/admin/system/audit` | `Link` via `AdminSidenav` | Existing page | OK |
| System admin sidenav in `admin/system/rooms`, `users`, `audit`, `settings` | `/admin/system/settings` | `Link` via `AdminSidenav` | Route was missing | Fixed with minimal準備中 page; kept nav because label is already visible and removing it would be a broader UX decision |
| Room admin sidenav in all `admin/rooms/[roomId]` pages | `/admin/rooms/${roomId}` | `Link` via `AdminSidenav` | Uses roomId; overview page exists | OK |
| Room admin sidenav in all `admin/rooms/[roomId]` pages | `/admin/rooms/${roomId}/members` | `Link` via `AdminSidenav` | Uses roomId; members page exists | OK |
| Room admin sidenav in all `admin/rooms/[roomId]` pages | `/admin/rooms/${roomId}/matches` | `Link` via `AdminSidenav` | Uses roomId; matches page exists | OK |
| Room admin sidenav in all `admin/rooms/[roomId]` pages | `/admin/rooms/${roomId}/standings` | `Link` via `AdminSidenav` | Uses roomId; standings page exists | OK |
| Room admin sidenav in all `admin/rooms/[roomId]` pages | `/admin/rooms/${roomId}/announcements` | `Link` via `AdminSidenav` | Uses roomId; announcements page exists | OK |
| Room admin sidenav in all `admin/rooms/[roomId]` pages | `/admin/rooms/${roomId}/settings` | `Link` via `AdminSidenav` | Uses roomId; settings page exists | OK |
| `src/app/admin/rooms/[roomId]/page.tsx` error state | `/admin/system/rooms` | `Link` | Existing system room list | OK |
| `src/app/admin/rooms/[roomId]/page.tsx` initial room fetch | `/api/admin/rooms/${roomId}` | `fetch()` gating page content after nav | API GET previously allowed only SYSTEM_ADMIN, causing ROOM_ADMIN `/admin` landing to show 403 | Fixed GET auth to allow assigned ROOM_ADMIN; PATCH/DELETE remain system-admin only |
| `src/app/admin/rooms/[roomId]/page.tsx` header action | `/admin/rooms/${roomId}/settings` | `Link` | Uses roomId; settings page exists | OK |
| `src/app/admin/rooms/[roomId]/page.tsx` quick actions | `/admin/rooms/${roomId}/members`, `/matches`, `#` | `Link` | Members/matches exist; CSV export is local placeholder | OK |
| `src/app/admin/rooms/[roomId]/page.tsx` match cards | `/watch/${match.id}` | `Link` | Uses matchId; `/watch/[matchId]` exists and remains proxy-excluded | OK |
| `src/app/admin/rooms/[roomId]/settings/page.tsx` after delete/archive | `/admin/system/rooms` | `window.location.href` | Existing system room list | OK |
| `src/app/admin/rooms/[roomId]/matches/page.tsx` watch actions | `/watch/${m.id}` | raw `<a>` | Uses matchId; watch route exists | OK |
| `src/app/admin/rooms/[roomId]/matches/page.tsx` match card meta | `metaRightHref` -> `/watch/${m.id}` when watchable | raw `<a>` | Uses matchId; watch route exists | OK |
| `src/app/admin/rooms/[roomId]/matches/page.tsx` calendar cells | `/watch/${c.matchId}` | raw `<a>` | Uses matchId; watch route exists | OK |
| `src/app/admin/system/settings/page.tsx` | `/admin/system/rooms` | `Link` | Existing system room list | Added placeholder back link |
| `src/app/api/auth/logout/route.ts` | `/login` | `NextResponse.redirect()` | Existing login page | OK |
| `src/app/layout.tsx` | Google Fonts URLs | HTML resource links | External preload/stylesheet resources, not app navigation | OK |

No form `action` navigation was found in `src/app` or `src/components`; mutations use `fetch()` and stay on-page unless listed above.
