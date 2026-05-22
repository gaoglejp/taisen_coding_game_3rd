# 対戦・コーディング v0.2

Blocklyで行動ロジックを組み、自動対戦するコーディング学習ゲーム。

Next.js 16 + React 19 + TypeScript + Prisma + PostgreSQL + Socket.io.

## Stack

- **Frontend**: Next.js 16 (App Router) / React 19 / TypeScript / inline styles + Tailwind v4 tokens
- **Backend**: Next.js Route Handlers + a custom HTTP server (`server.ts`) that hosts Socket.io alongside Next
- **Database**: PostgreSQL via Prisma 7 (with `@prisma/adapter-pg`)
- **Auth**: cookie-based sessions, bcrypt-hashed passwords

## Local development

1. Start Postgres (Docker):

   ```bash
   docker compose up -d
   ```

   …or run a local Postgres on `127.0.0.1:5432` with database `taisen_coding` (user/password `postgres/postgres`).

2. Install deps, push the schema, seed test data:

   ```bash
   npm install
   npm run db:push
   npm run db:generate
   npm run db:seed
   ```

3. Run the dev server (Next + Socket.io):

   ```bash
   npm run dev
   ```

   The server listens on `http://localhost:3000`. Sign in at `/login` with any of:

   - `sysadmin / password123!` — SYSTEM_ADMIN
   - `teacher01 / password123!` — ROOM_ADMIN
   - `taro_student / password123!` / `hanako_student / password123!` — ROOM_USER

## Screens

Player-facing (general UI — warm paper):

- `/login` `/signup` `/dashboard` `/rooms/[roomNumber]`
- `/match/[matchId]/coding` `/battle` `/result` · `/watch/[matchId]`

System admin (dark + purple):

- `/admin/system/rooms` `/admin/system/users` `/admin/system/audit`

Room admin (dark + teal):

- `/admin/rooms/[roomId]` (overview / members / matches / standings / settings)

Shared:

- `/error/[code]` — 404 / 403 / 500 / maintenance / websocket

## Project layout

- `src/app/` — App Router pages and route handlers
- `src/components/layout/` — `TopbarPaper`, `TopbarAdmin`, `AdminSidenav`, `ScopeBanner`
- `src/components/ui/` — `RoleBadge`, `StatusBadge`
- `src/lib/` — `db.ts` (Prisma client), `auth.ts` (sessions), `audit.ts`, `socket-server.ts`, `socket-client.ts`
- `prisma/schema.prisma` + `prisma/seed.ts`
- `server.ts` — custom Node server that mounts Next + Socket.io on a single port

## Design source

The original HTML/CSS prototypes live in `project/` and the design conversation in `chats/`. They are the source of truth for visual fidelity. The React implementation should be **visually equivalent** to those prototypes.
