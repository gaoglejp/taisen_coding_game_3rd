# Codex 作業指示 (第2弾): 観戦ページ実データ化 (Spectator real-data / Milestone B)

> Claude Code は別ブランチ (`claude/v0.2-implementation-handoff-ZapvB`) で
> 並行作業中。**着手前に `AGENTS.md` / `docs/HANDOFF.md` / `docs/ROADMAP.md` /
> `docs/STATUS.md` を読むこと。** 前回の announcements 機能 (PR #31) は
> マージ済み。今回はその次のタスク。

## 0. ブランチ / ワークフロー

- 作業ブランチ: **`codex/v0.2-spectator-realdata`**（`main` から作成）。
- `main` / Claude のブランチには直接 push しない。完了後に **PR（非ドラフト）**。
- push 前に `npx tsc --noEmit` / `npm run lint` / `npm test` / `npm run build` を通す。
- push 後に `docs/STATUS.md` 更新（Latest 差し替え・History 1行・Next 更新）、
  `docs/ROADMAP.md` の Milestone B 行、`docs/HANDOFF.md` §4 のモック残りを更新。
- Next.js 破壊的変更版: 動的 route の `params` は `Promise`（await）、
  route handler は `NextRequest`/`NextResponse`。リアルタイムは
  `tsx watch server.ts`（**`server.ts` のブート構成は変えない**。Socket.io の
  ハンドラ追加のみ。decision #1 参照）。

## 1. 全体像

観戦ページ `src/app/watch/[matchId]/page.tsx` で **まだモックの2つ** を実データ化し、
Milestone B（観戦体験）を実データで仕上げる。状態ギャラリーは Claude が PR #27 で
削除済み。

### スコープ内
1. **観戦者数 (viewer count)** を Socket.io のプレゼンスで実数化。
2. **試合タイムライン (timeline)** を replay / turn_event から導出（モック
   `TIMELINE_EVENTS` を置換）。

### スコープ外（やらない）
- **実況フィード (commentary)**: バックエンド機能が無く post-v0.2。現状の
  プレースホルダ文言のまま残す。
- **障害物 / アイテム**: シミュレータが未モデル化。post-v0.2 (TBD)。

## 2. 既存の足場（確認済み）

- `server.ts`:
  - `io.on("connection")` 内で `socket.on("join_match", ({matchId}) => socket.join(\`match:${matchId}\`))`。
  - `turn_event` / `match_result` は `io.to(\`match:${matchId}\`).emit(...)` で配信。
  - `socket.on("disconnect", ...)` は現状ログのみ。
- `src/lib/socket-client.ts`: `connectSocket(matchId)` が接続後に
  `join_match` を emit。`getSocket()` で同一ソケットを共有。
- 観戦ページ: `connectSocket(matchId)` 後に `socket.on("turn_event")` /
  `socket.on("match_result")` を購読。ヘッダで `<ViewerCount count={meta.viewerCount}
  delta={meta.viewerDelta} />`（`meta` はモック）。`TIMELINE_EVENTS` 定数
  （約57行目）をタイムライン節（約1127行目〜、`TIMELINE_EVENTS.map`）で描画。
- 完成試合のリプレイは `GET /api/match/:id/replay`（`replayData` をそのまま返す）。
  ターン形状は `src/lib/match-simulator.ts` の `TurnSnapshot`
  （`{ turn, p1, p2, logs }`、`p1/p2` は `PerPlayerTurn` で `hp`/`damaged`/
  `action`/`shoot_result` 等を持つ）。

## 3. 実装: 観戦者数（プレゼンス）

`server.ts`（**ハンドラ追加のみ**）:
- ヘルパ: `const count = io.sockets.adapter.rooms.get(\`match:${matchId}\`)?.size ?? 0;`
- `join_match` 内で `join` した後、その room に `io.to(\`match:${matchId}\`).emit("viewer_count", { matchId, count })` を送る。
- 切断時は **`socket.on("disconnecting", () => { ... })`** を使う（`disconnect` だと
  既に room を離脱済みで対象 room が分からない）。`socket.rooms` を走査して
  `match:` で始まる room それぞれについて、**離脱後の数 = 現在数 - 1** を計算して
  emit する（`disconnecting` 時点ではまだ自分が room に居るので `size` から1引く）。
- 注意: 単一プロセス想定で OK（複数インスタンス/Redis adapter は対象外）。

`src/lib/socket-client.ts`: 既存の `connectSocket` で十分（join 済み）。必要なら
`viewer_count` 購読のための型補助だけ追加（任意）。

観戦ページ:
- `socket.on("viewer_count", ({ count }) => setViewerCount(count))` を購読し、
  ヘッダ表示を実数に。`meta.viewerCount` モックを置換。
- `viewerDelta`（増減バッジ）は履歴ソースが無いので **撤去するか**、セッション中の
  直近値との差分（前回 count → 今回 count）に置き換える。捏造値は残さない
  （Claude が standings で fabricated delta を撤去したのと同じ方針）。

## 4. 実装: タイムライン（replay / turn_event から導出）

`TIMELINE_EVENTS` モックを廃止し、実ターンから「ティック」を導出する。**導出ルールを
明確化**（曖昧さ回避）:
- 各ターン `t` について、**命中**があれば1ティック:
  - `t.p1.damaged > 0` → 「P2 が P1 に命中 (T{turn}, -{damaged})」
  - `t.p2.damaged > 0` → 「P1 が P2 に命中 (T{turn}, -{damaged})」
  - 両方命中ならティック2件（順序は p1→p2 で安定化）。
- 試合終了で **決着ティック**: `match_result`（live）/ result 由来（finished）の
  勝者・終了理由（HP_ZERO / TIMEOUT 等）で「T{turn} 決着: {winner} ({reason})」。
- データソース:
  - **LIVE**: 入ってくる `turn_event` を配列に蓄積してティック生成（観戦ページは
    現状 latest しか保持していないので、ティック用に turns 配列 state を足す）。
  - **FINISHED/REPLAY**: マウント時に `GET /api/match/:id/replay` で
    `replayData.turns` を取得してティックを一括生成（任意だが望ましい。最低限
    LIVE 蓄積だけでも可。実装したら STATUS に記載）。
- 既存タイムライン UI の見た目（節の枠・各ティックの行スタイル）は流用し、
  描画データだけ実データに差し替える。新デザインを発明しない。空状態（ティック0件）の
  文言を用意。

## 5. 完了条件 / 検証

- `tsc` / `lint` / `npm test` / `build` すべてグリーン。
- ブラウザ確認はコンテナ不可。socket イベントの単体確認が難しい場合は、
  少なくとも型・build を通し、PR に「ブラウザ未検証（要手動: 2タブで観戦して
  viewer_count が増減するか / タイムラインが命中で増えるか）」と明記。
- 可能なら `server.ts` のプレゼンス計算やティック導出を **純関数に切り出して
  vitest** を足すと良い（必須ではない）。

## 6. 衝突回避

- Claude は現在 **route handler のテスト追加**（`*.test.ts` と docs）を実施中。
  観戦ページ / `server.ts` / `socket-client.ts` には触れていないので衝突は低い。
- 念のため作業前後に `main` を rebase。`server.ts` は慎重に（ブート構成不変）。
