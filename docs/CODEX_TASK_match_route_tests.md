# Codex 作業指示 (第8弾): マッチ read API のルートハンドラテスト

> Claude Code は別ブランチ (`claude/v0.2-implementation-handoff-ZapvB`) で
> 並行作業中。**着手前に `AGENTS.md` / `docs/HANDOFF.md` / `docs/ROADMAP.md` /
> `docs/STATUS.md` を読むこと。** 直前のプレイヤー read API テスト (PR #46) は
> マージ済み想定（未マージなら rebase 時に取り込まれる）。

## 0. ブランチ / ワークフロー

- 作業ブランチ: **`codex/v0.2-match-route-tests`**（`main` から作成）。
- `main` / Claude のブランチへ直接 push しない。完了後に **PR（非ドラフト）**。
- push 前に `npx tsc --noEmit` / `npm run lint` / `npm test` / `npm run build`。
- push 後に `docs/STATUS.md`（Latest 差し替え・History 1行）、`docs/HANDOFF.md` §5
  （テスト本数の更新）。

## 1. 全体像（テスト追加のみ・Vitest で完結・低衝突）

プレイヤー room/me 系は PR #46 でカバー済み。残る未テストは
**`/api/match/[matchId]/*` の read 系 4 本**。これを固めると **API ルート
ハンドラのテスト網羅が完成**する。判断不要・ブラウザ不要・新規 `*.test.ts` のみ。

### スコープ内（テスト対象）
1. `GET /api/match/[matchId]/public/route.ts`（公開観戦のアクセス可否）
2. `GET /api/match/[matchId]/state/route.ts`（コーディング/対戦の状態＋参加者/権限）
3. `GET /api/match/[matchId]/result/route.ts`（**replay 集計 `statsFor` が高価値**）
4. `GET /api/match/[matchId]/replay/route.ts`（`replayData` 返却・アクセス可否）

### スコープ外
- 実装本体（route.ts）の変更（必要時はまず相談）。
- 管理系 `/api/admin/*`、プレイヤー room/me 系（既に Claude/Codex で網羅）。
- Socket / `server.ts`。

## 2. 参考（既存の書き方）

手本は管理系 + PR #46 の player テスト:
- `src/app/api/admin/rooms/[id]/standings/route.test.ts`
- `src/app/api/admin/rooms/[id]/matches/[matchId]/cancel/route.test.ts`
- `src/app/api/rooms/[roomNumber]/route.test.ts`（PR #46・アクセス制御の手本）
- `src/app/api/me/stats/route.test.ts`（PR #46・replay 集計アサートの手本）

要点（再掲）:
- `vi.mock("@/lib/auth", () => ({ getSession: () => getSessionMock(), isAdmin: ..., isSystemAdmin: ... }))`
  （実 auth は読み込まない）。`vi.mock("@/lib/db", ...)` は使う model だけ。
  `import { GET } from "./route";` は **mock の後**。
- `params` は `{ params: Promise.resolve({ matchId: "m-1" }) }`。
- `req` は各ルートが読む分だけ（`nextUrl.searchParams` 等）を最小スタブ。
- レスポンスは `await GET(req, ctx)` の `.status` と `await res.json()` を検証。
- **期待値は各 route.ts を読んで厳密に**。憶測で書かない。

## 3. テスト観点（各ルートの実装に正確に合わせる）

- **共通**: 401（セッション無し）、404（マッチ無し）。
- **`/public`**: 公開観戦の可否（`isPublicWatch` / ルームの公開設定 / 参加者・管理者は可、
  非公開かつ無関係は 403 等）。実装の分岐に合わせる。
- **`/state`**: 参加者 or 管理者 or アクセス可能なルームメンバーが取得でき、
  返却に `codingDeadlineAt` / `room` / `player1/2` 等が含まれること。非公開・無権限は適切に弾く。
- **`/result`**: `replayData.turns` を持つ finished マッチを prisma モックで返し、
  `statsFor` 由来の集計（与ダメ=相手 `damaged` 合計、被ダメ、最終 HP、勝敗等）を
  合成データで検証。**ここが最も価値が高い**。実装の集計式を読んで期待値を厳密に。
- **`/replay`**: `replayData` がそのまま（または整形して）返ること、アクセス可否、
  `replayData` 未設定時の挙動（空 or 404 等）を実装どおりに。

## 4. 完了条件

- `tsc` / `lint` / `npm test`（既存 128 + 追加）/ `build` すべて green。既存を壊さない。
- 実装本体は変更しない（必要時は相談）。
- PR 本文: 対象 4 ルート / 観点（401・404・アクセス制御・replay 集計）/ 追加ケース数 / 合計本数。
- `docs/HANDOFF.md` §5 / `docs/STATUS.md` 更新。

## 5. 衝突回避

- 新規 `*.test.ts` のみ追加。実装本体は触らない。
- `/api/admin/*`・room/me 系には手を出さない（網羅済み）。作業前後に `main` rebase。

---

> 注: これで API ルートハンドラのテストはほぼ全面カバー。これ以降の「判断不要で
> 着手できる」並行作業はほぼ尽きるため、次は (a) プロダクト/スキーマ判断を要する
> 機能（招待コード `InviteCode` / 2FA / メール確認 / coding `lastTurn` 定義 /
> 真トーナメントブラケット / 障害物・アイテム）か、(b) Playwright E2E 基盤
> （CI にブラウザ + Postgres レーン）/ `next-auth` 依存削除、のいずれかになる見込み。
