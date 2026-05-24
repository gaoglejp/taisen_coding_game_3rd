# Codex 作業指示 (第3弾): ルーム概要のアクティビティ実データ化 (Room activity feed)

> Claude Code は別ブランチ (`claude/v0.2-implementation-handoff-ZapvB`) で
> 並行作業中（route handler テスト中心）。**着手前に `AGENTS.md` /
> `docs/HANDOFF.md` / `docs/ROADMAP.md` / `docs/STATUS.md` を読むこと。**
> 前回までの announcements (#31) と spectator real-data (#34) はマージ済み。

## 0. ブランチ / ワークフロー

- 作業ブランチ: **`codex/v0.2-room-activity`**（`main` から作成）。
- `main` / Claude のブランチへ直接 push しない。完了後に **PR（非ドラフト）**。
- push 前に `npx tsc --noEmit` / `npm run lint` / `npm test` / `npm run build` を通す。
- push 後に `docs/STATUS.md`（Latest 差し替え・History 1行・Next 更新）、
  `docs/HANDOFF.md`（§1 ルート一覧に新エンドポイント追記、§4 のモック残り更新）、
  `docs/ROADMAP.md`（Milestone D「Room overview page」注記の today/activity）を更新。
- Next.js 破壊的変更版: 動的 route の `params` は `Promise`（await）、
  route handler は `NextRequest`/`NextResponse`。

## 1. 全体像（スコープは小さめの縦スライス）

ルーム概要ページ `src/app/admin/rooms/[roomId]/page.tsx` の
**「アクティビティ」セクションがモック**（`MOCK_ACTIVITIES`、約46行目）。これを
**監査ログ由来の実データ**に置き換える。`AuditLog` は既に `targetRoomId` 付きで
書かれているため、新たな producer は不要（既存イベントを読むだけ）。

> ⚠️ 残りの大型機能（招待コード/2FA/メール確認/スケジュール源/真のブラケット木）は
> すべて**プロダクト判断 or スキーマ変更待ち**。本タスクは判断不要で着手できる
> クリーンな範囲に絞っている。

### スコープ内
1. 新エンドポイント `GET /api/admin/rooms/:id/activity`（監査ログのルーム絞り込み）。
2. 概要ページの「アクティビティ」を実データに配線（`MOCK_ACTIVITIES` 廃止）。

### スコープ外（やらない）
- `RoomActivity` モデルへの書き込み/新 producer 追加（未使用モデル。今回は
  **AuditLog 由来**に統一。RoomActivity は触らない）。
- 「本日のマッチ」系（概要の `activeMatches` は既に `/api/rooms/:n/matches` 配線済み）。
- `server.ts` / メンバー発行ルート等への producer 追加（Claude がテスト中。触らない）。

## 2. データモデル（既存・変更不要）

`AuditLog`（`prisma/schema.prisma`）:
```prisma
model AuditLog {
  id           String      @id @default(cuid())
  action       AuditAction
  actorId      String?
  targetType   String?
  targetId     String?
  targetRoomId String?     // ← ルーム絞り込みに使う
  summary      String?
  metadata     Json?
  createdAt    DateTime    @default(now())
  // ...(ip/userAgent/hash 等)
}
```
ルームに紐づく書き込み（メンバー発行 MEMBER_ISSUE、マッチ作成 MATCH_CREATE、
キャンセル MATCH_CANCEL、ルーム更新 ROOM_UPDATE=お知らせ含む 等）は
`logAudit(..., targetRoomId)` で `targetRoomId` が入っている。

## 3. エンドポイント `src/app/api/admin/rooms/[id]/activity/route.ts`

- 認可は **`isAdmin` + ROOM_ADMIN 自室チェック**（`src/app/api/admin/rooms/[id]/
  members/route.ts` や `.../standings/route.ts` と同型）。
  ⚠️ 既存 `/api/admin/audit` は **SYSTEM_ADMIN 専用**だが、本エンドポイントは
  ルーム単位なので ROOM_ADMIN も自室なら可、にする（room 系ルートに合わせる）。
- ルーム存在チェック（無ければ 404）。
- `prisma.auditLog.findMany({ where: { targetRoomId: id }, orderBy: { createdAt: "desc" }, take: limit })`
  （`limit` は `?limit=` で受け、既定 ~12、上限 ~50）。
- 著者名解決: `actorId` を集めて `prisma.user.findMany`（displayName ?? username）。
- 返却: `{ activities: [{ id, action, summary, actorName, targetType, targetId, createdAt }] }`。

## 4. 概要ページ配線 `src/app/admin/rooms/[roomId]/page.tsx`

- 既存の読み込み `useEffect`（`/api/admin/rooms/:id` 取得後に matches/standings を
  fetch している箇所、約95–113行目）に `GET /api/admin/rooms/:id/activity` を追加し、
  state にセット。`MOCK_ACTIVITIES` を削除。
- 「アクティビティ」描画（約303–行目、`MOCK_ACTIVITIES.map`）を実データに差し替え。
  - `time` は `createdAt` から整形（当日は `HH:MM`、それ以外は `M/D`）。
  - `ACTIVITY_ICON`（約54行目）を `AuditAction` ベースに拡張:
    例 `MATCH_CREATE: "⚔"`, `MATCH_CANCEL: "🚫"`, `MEMBER_ISSUE: "🔑"`,
    `MEMBER_REISSUE: "🔁"`, `MEMBER_DISABLE: "🚷"`,（適宜）`ROOM_UPDATE: "📢"`,
    `ROOM_CREATE/ARCHIVE/RESTORE/DELETE`, `USER_*`。未知 action はデフォルトアイコン。
  - メッセージ本文は監査の `summary` を使用（`actorName` を併記してもよい）。
  - 空状態（0件）の文言を用意。
- ⚠️ 実イベント集合は旧モック（MATCH_START/END/MEMBER_JOIN）とは異なる
  （監査にあるのは作成/キャンセル/発行/更新など）。**MATCH_START/END は監査対象外
  なので捏造しない**。実データに素直に従う。

## 5. 完了条件 / 検証

- `tsc` / `lint` / `npm test` / `build` 緑。ブラウザ未検証は PR に明記。
- 可能なら time 整形や action→icon マッピングを純関数化して vitest 追加（任意）。
  本ルートのハンドラテスト（401/403/404/own-room/整形）は `@`-alias 済みなので
  `vi.mock("@/lib/auth"|"@/lib/db")` で書ける（`src/app/api/admin/rooms/[id]/
  standings/route.test.ts` が参考）。
- PR 本文: 概要 / エンドポイント / ページ差分 / テスト手順 / 未検証点。

## 6. 衝突回避

- Claude は `*.test.ts`（route handler テスト）と docs を編集中。今回 Codex が
  触るのは **新規 route ファイル + 概要ページ** のみ。`server.ts` /
  メンバー・ユーザー系ルート本体には触れない（テスト対象なので）。
- 作業前後に `main` を rebase。
