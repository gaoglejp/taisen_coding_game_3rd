# Codex 作業指示 (第9弾): Playwright E2E スモーク基盤 (まず Scope A)

> Claude Code は別ブランチで並行作業中。**着手前に `AGENTS.md` /
> `docs/HANDOFF.md` / `docs/ROADMAP.md` / `docs/STATUS.md` / `docs/TESTPLAY.md`
> を読むこと。** `docs/TESTPLAY.md` が手動の通し手順で、本 E2E はその自動化版。

## 役割分担（重要）
- **最終確認（仕様判断）は Claude/人間**が `docs/TESTPLAY.md` で実施する。
- **Codex は「完成度を上げる自動テスト（E2E）」基盤と回帰スモークを担当**する。
- Codex は **CLI 実行環境がある**前提。**ローカルで E2E を実際に実行して green を
  確認してから push すること**（CI 任せにしない）。

## 0. ブランチ / ワークフロー
- 作業ブランチ: **`codex/v0.2-e2e-smoke`**（`main` から作成）。
- `main` / Claude のブランチへ直接 push しない。完了後 **PR（非ドラフト）**。
- push 前に既存の `npx tsc --noEmit` / `npm run lint` / `npm test`（vitest）/
  `npm run build` が緑であること（E2E 追加で既存を壊さない）。
- push 後に `docs/STATUS.md`（Latest 差し替え）/ `docs/HANDOFF.md`（E2E の存在を §1/§5 等に追記）更新。

## 1. ゴール（今回 = Scope A のみ）

**Playwright E2E の土台を作り、最小スモークを green にする**。フル対戦フロー
（Scope B）は土台が固まってからの次タスク。今回で欲を出して B まで広げない。

### Scope A（今回やる）
1. Playwright 導入（`@playwright/test`、`playwright.config.ts`）。
2. アプリと DB を E2E 用に起動できるようにする（下記「実行モデル」）。
3. **ログイン〜役割別着地のスモーク**（最小）:
   - `sysadmin` / `teacher01` / `taro_student` / `hanako_student` でログイン →
     それぞれ期待ページ（例: ダッシュボード or 管理トップ）に着地し、主要要素が見える。
   - 未ログインで保護ページ → `/login` 等へ流れる（実装の挙動に合わせる）。
   - seed のルームページ（`/rooms/<roomNumber>`）が学生で 200 表示。
4. **CI レーン**: PR で E2E が走るよう GitHub Actions に追加（Postgres service +
   `playwright install --with-deps chromium` + db push/seed + build + run）。

### Scope B（**今回はやらない**・次タスク）
- 2 つのブラウザコンテキストで taro/hanako がコーディング→lock→自動で battle→result、
  観戦の viewer_count 増減まで。Socket.io 同期が絡むので土台確定後に。

## 2. 既存の足場（確認済み・実行モデル）

- 起動: `npm run dev`（`tsx watch server.ts`、Next + Socket.io @ :3000）。
  本番起動は `npm run build` → `npm run start`（`NODE_ENV=production tsx server.ts`）。
- DB: **Postgres 必須**（Prisma `provider = "postgresql"`）。
  `docker-compose.yml` に `postgres:16-alpine`（user/pass `postgres`、db
  `taisen_coding`、:5432）。`.env`:
  `DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/taisen_coding"`,
  `NEXT_PUBLIC_APP_URL="http://localhost:3000"`。
- スキーマ反映 + seed: `npm run db:push` → `npm run db:seed`
  （`tsx prisma/seed.ts`）。seed アカウント等は `docs/TESTPLAY.md` 参照。
- 既存テストは **Vitest（ユニット）**。E2E は Playwright で **別系統**にする
  （`vitest` の include は `src/**/*.test.ts(x)` なので、E2E は `e2e/**/*.spec.ts`
  等に置き、vitest の対象外にする — 名前衝突に注意）。

## 3. 実装方針

- `@playwright/test` を devDependency に追加。`npx playwright install --with-deps chromium`
  （CI とローカル両方）。
- `playwright.config.ts`:
  - `testDir: "e2e"`, `use: { baseURL: "http://localhost:3000" }`, chromium のみ。
  - `webServer`: アプリを起動して待つ。**DB は webServer 起動前に push+seed 済みである
    前提**にする（webServer コマンドを `npm run start` か、安定すれば `npm run dev`）。
    `reuseExistingServer: !process.env.CI`。
  - スモークの安定性のため、**ビルド済み起動（start）**を推奨。
- E2E 用のセットアップ手順（ローカル & CI 共通の考え方）:
  1. Postgres 起動（ローカル: `docker compose up -d postgres` / CI: services postgres）。
  2. `DATABASE_URL` を設定。
  3. `npm run db:push && npm run db:seed`。
  4. `npm run build`。
  5. Playwright が `webServer` で `npm run start` を起動 → スペック実行。
- スペックは seed アカウントを使う（`docs/TESTPLAY.md` の認証情報）。ログインは
  実際の `/login` フォーム送信で行う（API 直叩きでもよいが、UI 経路が望ましい）。
- セレクタは壊れにくいものを（role/text ベース、必要なら最小限 `data-testid` を
  **コンポーネントに足してよい**が、足したら最小差分で）。

## 4. CI レーン

- `.github/workflows/` に E2E ジョブ（既存 `ci.yml` に job 追加でも、別 workflow でも可）:
  - `services: postgres:16`（health check）。
  - `npm ci` → `npx playwright install --with-deps chromium` →
    `DATABASE_URL=... npm run db:push && npm run db:seed` → `npm run build` →
    `npx playwright test`。
  - 失敗時に `playwright-report` / traces を artifacts 化すると後で読める。
- 既存 lint/tsc/build/vitest のジョブは壊さない（E2E は追加ジョブ）。

## 5. 自己検証（CLI 環境を活用・必須）

push 前に**ローカルで実際に通す**:
```bash
docker compose up -d postgres      # or 既存 Postgres
cp -n .env.example .env
npm ci
npx playwright install --with-deps chromium
npm run db:push && npm run db:seed
npm run build
npx playwright test                # 全スモーク green を確認
```
（Postgres や docker が使えない環境なら、その制約と取った代替手段を PR に明記。）

## 6. 完了条件（Scope A）

- ローカルで Playwright スモークが green（ログイン4ロール + 保護リダイレクト +
  ルームページ表示）。既存 `tsc`/`lint`/`vitest`/`build` も green。
- CI に E2E ジョブが追加され、PR で走る。
- PR 本文: 導入物 / 実行方法 / スモーク内容 / CI ジョブ / **Scope B は次タスク**である旨。
- `docs/STATUS.md` 更新、`docs/HANDOFF.md` に E2E の起動方法を追記。

## 7. 衝突回避
- 追加物中心（`e2e/`, `playwright.config.ts`, CI job, `package.json` の devDep）。
  既存ファイルの変更は最小限（`data-testid` を足す場合のみ）。
- Claude は route テスト等で `src/app/api/**` を触りうるが、E2E は別ディレクトリなので
  衝突低。作業前後に `main` を rebase。
