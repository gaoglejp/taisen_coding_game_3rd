# Codex 作業指示 (第11弾): 練習モード（ソロバトル）の実装

> Claude Code は別ブランチで並行作業中。**着手前に `AGENTS.md` /
> `docs/HANDOFF.md` / `docs/ROADMAP.md` / `docs/STATUS.md` を読むこと。**
> 本タスクは現在「準備中」プレースホルダのままの `/practice` を、実際に遊べる
> ソロ対戦練習機能にする開発タスク。

## 役割分担（重要・不変）
- **最終確認（仕様判断）は Claude/人間**。**Codex は実装と、CLI 環境での自己検証**。
- Codex は CLI 実行環境あり。**push 前にローカルで `tsc`/`lint`/`vitest`/`build`、
  および（E2E を足す場合は）`playwright test` を実走して green を確認**すること。

## 0. ブランチ / ワークフロー
- 作業ブランチ: **`codex/v0.2-practice-solo`**（最新の `main` から作成）。
- `main` / Claude のブランチへ直接 push しない。完了後 **PR（非ドラフト）**。
- push 前に `npx tsc --noEmit` / `npm run lint` / `npm test` / `npm run build` 緑。
- push 後に `docs/STATUS.md`（Latest 差し替え・前 Latest を History へ）と
  `docs/ROADMAP.md`（Milestone B / 該当行）を更新。新しい設計判断を固めたら
  `docs/HANDOFF.md` §3 にも追記。

## 1. ゴール

`/practice`（ダッシュボードの「練習する (ソロバトル)」導線の先）で、**ログインユーザー
が自分のストラテジーをブロックで組み、ビルトインの相手 bot と1回のソロ対戦を実行し、
バトルのリプレイと結果を見られる**ようにする。ルーム/対戦相手/Socket.io 不要の
スタンドアロン機能。

### 完成イメージ（UXフロー）
1. `/practice` を開く → Blockly エディタでストラテジーを組む（既存のコーディング画面と
   同じエディタ）。難易度（相手 bot）を選べると尚良いが、まずは1体でも可。
2.「対戦開始（練習）」を押す → サーバがユーザー戦略 vs bot 戦略を `simulate` し、
   リプレイ（turns）+ 結果を返す。
3. 盤面リプレイをターン送りで再生（既存バトル画面と同等の見た目）し、決着後に
   結果（勝敗 / 残HP / ターン数 / 終了理由）を表示。もう一度組み直して再挑戦できる。

## 2. 再利用する既存部品（重要・車輪の再発明をしない）

- **Blockly エディタ**: `src/components/coding/BlocklyEditor.tsx`
  - props: `onChange?(strategy: Strategy, state: string)`, `readOnly?`, `initialState?`。
  - `next/dynamic` で SSR 無効ロード（DOM 依存）。コーディング画面
    （`src/app/match/[matchId]/coding/page.tsx`）の使い方をそのまま踏襲。
- **ブロック → Strategy 変換 / 既定ワークスペース**: `src/lib/strategy-blocks.ts`
  （`workspaceToStrategy`, `DEFAULT_WORKSPACE_STATE`, `STRATEGY_TOOLBOX`）。
- **シミュレータ**: `src/lib/match-simulator.ts`
  - `simulate(s1: Strategy, s2: Strategy, options?: { maxTurns }): SimulationResult`
    （純粋関数）。戻り値 `{ turns: TurnSnapshot[], winner: "p1"|"p2"|null,
    endReason: "HP_ZERO"|"TIMEOUT", finalHp: { p1, p2 } }`。定数 `MAX_TURNS=20`,
    `INITIAL_HP=100`, `GRID_SIZE=10`。
  - **相手 bot の戦略**は `Strategy` 型のオブジェクトとしてサーバ側に定義する。参考に
    なる単純な戦略は `src/lib/match-simulator.test.ts` 冒頭（`alwaysShoot`,
    `seekAndShoot` 等）。最低1体、できれば「弱い/普通」程度の2段階。
- **バトル盤面の描画**: 既存 `src/app/match/[matchId]/battle/page.tsx` は
  `TurnSnapshot` を描画するが、**MOCK_MATCH と Socket.io（`turn_event`）に密結合した
  クライアントページ**でそのままは流用しづらい。方針は §3 参照。

## 3. 実装方針（推奨）

### サーバでシミュレート（推奨：本番の対戦と同じくサーバ権威 + simulator を
クライアントバンドルに載せない）
- **`POST /api/practice/simulate`**（route handler, `NextRequest`/`NextResponse`）:
  - body: `{ strategy: Strategy, difficulty?: "easy"|"normal" }`（必要なら maxTurns）。
  - サーバで bot 戦略を選び `simulate(userStrategy, botStrategy)` を実行、
    `SimulationResult`（turns/winner/endReason/finalHp）を JSON で返す。
  - **Match レコードは作らない**（練習は履歴/順位に影響させない）。DB 書き込み無し。
  - 認証は任意だが、ログインユーザー向け機能なので `getSession()` で軽くガードして
    良い（未ログインは 401 か /login。下記アクセス制御参照）。

### 練習ページ `/practice`
- 既存プレースホルダを置き換え。`TopbarPaper title="練習モード"` 等の既存クロームを維持。
- 上部に Blockly エディタ（`BlocklyEditor` を dynamic import、`onChange` で Strategy を保持）。
- 「対戦開始（練習）」ボタン → `/api/practice/simulate` を叩き、返ってきた `turns` を
  ターン送りで再生（`setInterval` 等でローカル再生。Socket.io は使わない）。
- 盤面/HP/結果の見た目は**既存バトル/結果画面と視覚的に一致**させる
  （**練習用のプロトタイプは存在しない**ので、新規デザインを発明せず、既存の
  バトル画面・結果画面のスタイルに合わせる）。
- 再生中の途中参加同期は不要（リプレイは手元に全部ある）。決着後に結果サマリ + 「再挑戦」。

### 盤面描画の重複について
- 既存 `battle/page.tsx` から盤面/HP バーなどを**共有コンポーネントに切り出して再利用**
  しても良い（その場合は battle 側も壊さないこと）。切り出しが大きくなるなら、練習側に
  軽量な自前リプレイ描画を置くのも可。**どちらでも良いが、既存バトル画面の挙動は壊さない**。

## 4. 決定事項・スコープ境界（迷ったらここに従う）
- 練習は**スタンドアロン**: Match 作成なし / Socket.io なし / 永続化なし / 成績に非反映。
- 相手は**ビルトイン bot 戦略**（人間相手・マッチングは対象外）。
- **障害物 / アイテム / AP** はシミュレータ未実装のため**対象外**（`maxTurns` のみ既存どおり）。
- `lastTurn` 認識タブ等のコーディング画面固有機能は**持ち込まない**。
- アクセス制御: 現状 `src/proxy.ts` の matcher に `/practice` は**含まれていない**。
  ログイン必須にしたいなら matcher に `/practice` を追加 + API 側 `getSession` ガード。
  （要否は軽い判断。少なくとも API はログインユーザー前提で良い。）

## 5. テスト（CLI で実走）
- **ユニット/ルートハンドラ**: `POST /api/practice/simulate` の route handler テスト
  （既存の route テストの作法＝`@/lib/*` を vi.mock。本 API は DB 不要なので簡単）。
  - 正常: 妥当な strategy → 200 + `turns`/`winner`/`finalHp` を含む。
  - 異常: 不正な body → 400。
  - 既存スイート（現在 **146**）を増やす。
- **E2E（推奨・任意）**: `e2e/` に練習スモークを1本。ログイン → `/practice` →
  既定ブロックのまま「対戦開始」→ リプレイが進み結果表示が出る、を assert。
  既存の `playwright.config.ts`（workers:1 / `npm run start`）に乗る。seed 破壊なし。
- push 前にローカルで全テスト green を確認（E2E を足したら `npx playwright test` も）。

## 6. 完了条件
- `/practice` で実際にブロックを組んで bot と練習対戦でき、リプレイ→結果まで動く。
- `tsc`/`lint`/`vitest`/`build`（+ 足したら E2E）すべて green。
- PR 本文: 何を作ったか / API 仕様 / bot 戦略 / 再利用した部品 / スコープ外にしたもの /
  実行確認ログ。
- `docs/STATUS.md` 更新、`docs/ROADMAP.md` の該当行更新、必要なら `docs/HANDOFF.md` §3 追記。

## 7. 衝突回避
- 追加中心（`src/app/api/practice/`, `/practice` の page 差し替え, テスト）。
  既存の `match-simulator.ts` / `BlocklyEditor.tsx` / `strategy-blocks.ts` は
  **変更せず再利用**（バグ発見時は PR 本文で切り分け報告、修正は最小差分）。
- `battle/page.tsx` を共有化のため触る場合は既存挙動を壊さない。
- 着手前後に最新 `main` を rebase。
