# Codex 作業指示 (第7弾): プレイヤー向け read API のルートハンドラテスト

> Claude Code は別ブランチ (`claude/v0.2-implementation-handoff-ZapvB`) で
> 並行作業中。**着手前に `AGENTS.md` / `docs/HANDOFF.md` / `docs/ROADMAP.md` /
> `docs/STATUS.md` を読むこと。** 直前の「あなたの予定」(PR #44) はマージ済み。

## 0. ブランチ / ワークフロー

- 作業ブランチ: **`codex/v0.2-player-route-tests`**（`main` から作成）。
- `main` / Claude のブランチへ直接 push しない。完了後に **PR（非ドラフト）**。
- push 前に `npx tsc --noEmit` / `npm run lint` / `npm test` / `npm run build`。
- push 後に `docs/STATUS.md`（Latest 差し替え・History 1行）、`docs/HANDOFF.md` §5
  （テスト本数の更新）を更新。

## 1. 全体像（テスト追加のみ・**Codex 自身で検証可能**・低衝突）

管理系 API はルートハンドラテストが揃った（PR #30/#32/#36/#38、計 ~50 ケース）。
一方 **プレイヤー向け read API は未テスト**。アクセス制御（メンバーシップ /
公開ロビー / 管理者）と replay 集計は security/correctness 上重要なので、ここを
ユニットテストで固める。新規テストファイルのみ追加するので**衝突リスクは最小**。

> 📌 これは判断不要・ブラウザ不要（Vitest で完結）。ハーネスは既に
> `vitest.config.ts` の `@`→`src` alias 済み。管理系テストと同じ書き方で書ける。

### スコープ内（テスト対象）
1. `GET /api/rooms/[roomNumber]/route.ts`（ルーム取得・アクセス制御）
2. `GET /api/rooms/[roomNumber]/matches/route.ts`（アクティブマッチ）
3. `GET /api/rooms/[roomNumber]/standings/route.ts`（順位）
4. `GET /api/me/stats/route.ts`（replay 集計：勝敗/ターン/ダメージ）
5. `GET /api/me/matches/route.ts`（最近のマッチ）

### スコープ外
- ルート本体（実装）の変更（テストで挙動を変える必要が出たら、まず Issue/PR コメントで相談）。
- `/api/match/[matchId]/*`（public/state/result）— 余力があれば追加してよいが必須でない。
- `/api/rooms/[roomNumber]/announcements`（Codex が #31 で実装済み・任意）。

## 2. 参考（既存の書き方）

`src/app/api/admin/rooms/[id]/standings/route.test.ts` /
`.../matches/[matchId]/cancel/route.test.ts` が手本。要点:
- `vi.mock("@/lib/auth", () => ({ getSession: () => getSessionMock(), isAdmin: ..., isSystemAdmin: ... }))`
  — 実 auth は `next/headers` を import するので**読み込まない**。必要な関数だけ
  モックで再実装（`isAdmin`/`isSystemAdmin` は role 判定の素朴な実装でよい）。
- `vi.mock("@/lib/db", () => ({ prisma: { ... 使う model だけ ... } }))`。
- `vi.mock("@/lib/audit", ...)`（read 系は監査を呼ばないことが多い。呼ぶ場合のみ）。
- `import { GET } from "./route";` を **vi.mock の後**に置く。
- `req` は最小スタブ: `{ nextUrl: { searchParams: new URLSearchParams(qs) } }` を
  `as unknown as Parameters<typeof GET>[0]` でキャスト（`req.json()` を読む POST と違い
  GET は searchParams のみ使うことが多い。各ルートの実装を読んで必要分だけ用意）。
- `params` は `{ params: Promise.resolve({ roomNumber: "R-1" }) }` のように Promise で渡す。
- レスポンスは `const res = await GET(req, ctx); expect(res.status).toBe(...); const j = await res.json();`。

## 3. テスト観点（各ルートは実装を読んで正確に）

各ルートで最低限:
- **401**: セッション無し。
- **アクセス制御**: 学生ルーム系（rooms/*）は「SYSTEM_ADMIN / 自室 ROOM_ADMIN /
  当該ルームの ACTIVE membership のいずれか可、PUBLIC_LOBBY はメンバー不要、
  それ以外で非メンバーは 403」。`room.status === "DELETED"` は 404。
  → 実装（`src/app/api/rooms/[roomNumber]/route.ts` 等）の分岐に正確に合わせる。
- **正常系**: 期待する形（`{ room }` / `{ matches }` / `{ standings }` など）が返る。
- **`/api/me/stats`**: replay 集計の検証が高価値。合成した `replayData.turns`
  （`p1/p2.damaged` 等）を持つ finished マッチを prisma モックで返し、
  勝敗・ダメージ・ターンの集計値をアサート（管理 standings テストの damage 集計の
  考え方を流用：自分の与ダメ=相手の `damaged` 合計）。実装の集計ロジックを読んで
  期待値を厳密に。
- **`/api/me/matches`**: 認証＋件数/整形（limit クエリがあればクランプ等）を実装に沿って。

> 重要: 期待値は**実装を読んで**決めること（憶測で書かない）。replay 集計は
> `src/app/api/match/[matchId]/result/route.ts` の `statsFor` と同じ規約のはず。

## 4. 完了条件

- `tsc` / `lint` / `npm test`（既存 112 + 追加）/ `build` すべて green。
- 既存テストを壊さない。実装は原則変更しない（必要時は相談）。
- PR 本文: 対象ルート / 観点（401・アクセス制御・集計）/ 追加ケース数 / 合計本数。
- `docs/HANDOFF.md` §5 と `docs/STATUS.md` を更新。

## 5. 衝突回避

- Claude も route テストを書くため、**重複回避**: Codex は上記
  **プレイヤー read 系のみ**を担当。管理系（`/api/admin/*`）には手を出さない
  （Claude が網羅済み）。新規 `*.test.ts` ファイルのみ追加で実装本体は触らない。
- 作業前後に `main` を rebase。
