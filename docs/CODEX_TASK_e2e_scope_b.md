# Codex 作業指示 (第10弾): Playwright E2E Scope B — 対戦フル loop + 観戦 viewer_count

> Claude Code は別ブランチで並行作業中。**着手前に `AGENTS.md` /
> `docs/HANDOFF.md` / `docs/ROADMAP.md` / `docs/STATUS.md` / `docs/TESTPLAY.md`
> / `docs/CODEX_TASK_e2e_smoke.md`(= Scope A、既にマージ済み)を読むこと。**
> 本タスクは Scope A の土台(`e2e/`, `playwright.config.ts`, CI `e2e` ジョブ)に
> **追加**する形で Scope B を実装する。Scope A の足場は壊さない。

## 役割分担(重要・前回から不変)
- **最終確認(仕様判断)は Claude/人間**が `docs/TESTPLAY.md` で実施する。
- **Codex は「完成度を上げる自動テスト(E2E)」と回帰スモークを担当**する。
- Codex は **CLI 実行環境がある**前提。**ローカルで E2E を実際に実行して green を
  確認してから push すること**(CI 任せにしない)。Socket.io 同期が絡むため、
  ローカル実走での安定確認が今回の肝。

## 0. ブランチ / ワークフロー
- 作業ブランチ: **`codex/v0.2-e2e-scope-b`**(最新の `main` から作成)。
- `main` / Claude のブランチ(`claude/v0.2-implementation-handoff-ZapvB`)へ直接
  push しない。完了後 **PR(非ドラフト)**。
- push 前に `npx tsc --noEmit` / `npm run lint` / `npm test`(vitest)/
  `npm run build` が緑であること。**かつ `npx playwright test` がローカルで緑**。
- push 後に `docs/STATUS.md`(Latest 差し替え・前 Latest を History へ)/
  `docs/ROADMAP.md`(Milestone A/B の該当行)/ 必要なら `docs/HANDOFF.md` を更新。

## 1. ゴール(今回 = Scope B)

**2 つのブラウザコンテキストで対戦をフルに通し、観戦の viewer_count も検証する。**
Scope A は「ログイン〜着地」の単一コンテキストだったが、本タスクは Socket.io を
介した **複数クライアント同期**を実走で確認する。

### テスト 1: フル対戦 loop(taro vs hanako)
1. **2 つの独立した browser context** を作る(`browser.newContext()` を 2 回、
   または `test` 内で 2 context)。それぞれ taro_student / hanako_student で
   `/login` から実ログイン。
2. 両者を **同じ CODING マッチのコーディング画面**へ移動させる(下記「2. 実装の
   要所」参照。seed の match #2 = `ROOM-2026-0001` の matchNumber 2、
   player1=taro / player2=hanako)。
3. 両者が **コードを確定**する(「コードを確定する」→ 確認モーダル →「確定する」)。
   - 1 人目ロック後は「相手の確定を待っています」状態になることを確認。
   - 2 人目ロック後、**両画面が自動で `/match/<id>/battle` に遷移**する
     (`match_started` 駆動。`coding/page.tsx:139` の `router.push(.../battle)`)。
4. **battle 画面**でターンが進行し、決着すると **`/result` への導線(Link)が出る**
   (`battle/page.tsx:511` 付近、`match_result` 後に表示)。**自動遷移ではない**
   ので、Link をクリックして `/match/<id>/result` に着地し 404 でないことを確認。
5. result 画面に実データ(勝者/HP 等)が表示されることを軽く assert。

### テスト 2: 観戦 viewer_count
- 上記対戦中(または別 seed マッチ)に **3 つ目の context** で
  `/watch/<matchId>` を開き、`join_match` により **viewer_count 表示が増える**
  ことを確認(`watch/page.tsx` の `ViewerCount`、`aria-label="観戦者数"`)。
- 観戦タブを閉じる(context close)と count が減ることも確認できれば加点
  (`disconnecting` で `count-1` をブロードキャスト。タイミングが不安定なら
  「増えること」だけでも可)。
- `/watch` は **匿名可**(public 観戦)。ログイン無しでも開ける想定だが、seed の
  match が `isPublicWatch: true` であることを前提にする。

## 2. 実装の要所(ハマりどころ)

- **matchId の取り方**: matchId は cuid で seed 固定値ではない。両コンテキストを
  同じマッチに入れるには、room 経由で導出するのが堅い:
  `/rooms/ROOM-2026-0001` →「入室する」→ URL が `/match/<id>/coding` になる。
  その `<id>` を `page.url()` から正規表現で抜き、もう一方の context も同じ
  `/match/<id>/coding` へ `goto` する。あるいは両者それぞれ room 経由で入室すれば
  同じ CODING マッチ(#2)に入る想定。**どちらの導線が安定するか実走で確認**し、
  確定した方をコメントで明記。
- **seed は対戦で消費される(破壊的)**: match #2 はロック完了で BATTLING→FINISHED
  に遷移し、**再実行では再ロックできない**。よって本テストは **毎回 db:seed で
  リセットされた状態を前提**にする(`seed.ts` は match #2 を upsert で CODING /
  strategy1,2=DbNull に戻す実装になっている = 26〜33 行目の `update` 句)。
  CI は毎回 seed するので OK。**ローカルで 2 回目を走らせる前は `npm run db:seed`
  を再実行**すること。テスト内で seed を呼ぶ必要はない(webServer 起動前の
  グローバル前提でよい)。必要なら Playwright の `globalSetup` で seed する手も
  あるが、Scope A の実行モデル(外部で push+seed 済み前提)を踏襲して可。
- **同期待ちは固定 sleep ではなく条件待ち**で: `expect(page).toHaveURL(...)` /
  `expect(locator).toBeVisible()` の自動リトライを使う。battle のターン進行は
  サーバ側 `TURN_DELAY_MS=1200ms × ターン数`(`server.ts:36`)かかるので、
  result 導線の出現待ちは **タイムアウトを長め(例: 30〜60s)**に設定する。
- **2 context の Socket.io 認証**: socket は session cookie で認証する
  (`server.ts:112` の `io.use`)。各 context で実ログインすればクッキーが付くので、
  特別な細工は不要。API 直叩きログインにする場合はクッキーが context に乗ることを
  確認。
- **webServer は build 済み起動(`npm run start`)推奨**(Scope A と同じ)。dev の
  HMR でリアルタイムが不安定になるのを避ける。

## 3. 自己検証(CLI 環境を活用・必須)

push 前に**ローカルで実際に通す**:
```bash
docker compose up -d postgres            # or 既存 Postgres
npm ci
npx playwright install --with-deps chromium
npm run db:push && npm run db:seed       # ← Scope B は破壊的。再走前は毎回 seed
npm run build
npx playwright test                      # Scope A + B 全部 green を確認
# 不安定さがないか 2〜3 回連続実行(間に db:seed を挟む)で flake を潰す
```
(Postgres / docker が使えない環境なら、その制約と取った代替手段を PR に明記。)

## 4. CI レーン
- 既存 `e2e` ジョブにそのまま乗る(追加スペックなので job 追加は不要)。seed が
  毎回走ることを確認。失敗時の `playwright-report` / trace artifacts は Scope A で
  入っていればそのまま活かす。無ければ追加すると後で読める。
- 既存 lint/tsc/build/vitest と Scope A スモークを壊さない。

## 5. 完了条件(Scope B)
- ローカルで Playwright が **Scope A + B 全て green**(対戦フル loop の自動遷移 →
  result 着地 + 観戦 viewer_count 増加)。既存 `tsc`/`lint`/`vitest`/`build` も green。
- flake 対策(条件待ち / タイムアウト調整)を入れ、連続実行で安定。
- PR 本文: 追加スペック内容 / matchId 導出方法(確定した導線)/ 実行方法 /
  flake 対策 / seed が破壊的である旨 を明記。
- `docs/STATUS.md` 更新、`docs/ROADMAP.md` の Milestone A(対戦 loop)/ B
  (viewer_count)該当行に E2E カバレッジを反映。

## 6. 衝突回避
- 追加物中心(`e2e/*.spec.ts`、必要なら最小限の `data-testid`)。既存ファイルの
  変更は最小限。`server.ts` / coding・battle・watch ページのロジックは**変えない**
  (テストが通らない場合でも、まず実装ではなくセレクタ/待機を疑う。実装側のバグを
  見つけたら PR 本文に切り分けて報告し、修正は最小差分で)。
- 着手前後に最新 `main` を rebase。Claude は引き続き別ブランチで作業中。
