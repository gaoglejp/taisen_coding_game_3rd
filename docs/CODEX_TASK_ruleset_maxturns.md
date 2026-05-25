# Codex 作業指示 (第4弾): ルーム ruleset をシミュレータへ反映 (maxTurns)

> Claude Code は別ブランチ (`claude/v0.2-implementation-handoff-ZapvB`) で
> 並行作業中（route handler テスト中心）。**着手前に `AGENTS.md` /
> `docs/HANDOFF.md` / `docs/ROADMAP.md` / `docs/STATUS.md` を読むこと。**
> 前回までの announcements (#31) / spectator (#34) / room-activity (#37) は
> マージ済み。

## 0. ブランチ / ワークフロー

- 作業ブランチ: **`codex/v0.2-ruleset-maxturns`**（`main` から作成）。
- `main` / Claude のブランチへ直接 push しない。完了後に **PR（非ドラフト）**。
- push 前に `npx tsc --noEmit` / `npm run lint` / `npm test` / `npm run build` を通す。
- push 後に `docs/STATUS.md`（Latest 差し替え・History 1行・Next 更新）、
  `docs/HANDOFF.md`（design note の「rulePreset は simulator-inert」を更新）、
  `docs/ROADMAP.md`（該当あれば）を更新。
- Next.js 破壊的変更版。リアルタイムは `tsx watch server.ts`
  （**`server.ts` のブート構成は変えない**。ハンドラ/関数内のロジック追加のみ）。

## 1. 全体像（gameplay の縦スライス・**ユニットテストで検証可能**）

現在、ルーム設定の **ruleset (rulePreset) はシミュレータに反映されていない**
（PR #19 の設計メモ「rulePreset round-trips but is simulator-inert」）。
本タスクでは、その中で**唯一すでにシミュレータがモデル化している `maxTurns`
だけ**を実際の対戦に反映する。これでルーム管理者が設定したターン上限が
実際の試合に効くようになる。プラミング（ルーム設定→simulate へ config を渡す）
を確立し、将来の項目はそこに足せる形にする。

### スコープ内
1. `simulate()` に **任意の config 引数**（`{ maxTurns?: number }`）を追加。
2. `server.ts` の試合実行で、対象ルームの `rulePreset.maxTurns` を読み、
   `simulate()` に渡す。
3. シミュレータの**ユニットテストを追加/拡張**（custom maxTurns が効くこと）。

### スコープ外（やらない・post-v0.2 / 要判断）
- `ap` / `obstacles` / `items` 等の他 ruleset 項目（シミュレータ未モデル化、TBD）。
- `codingTimeLimitSec`（コーディング画面のタイマー側の話。別タスク）。
- バランス調整・新アクション。

## 2. 既存の足場（確認済み）

- `src/lib/match-simulator.ts`:
  - `export const MAX_TURNS = 20;`（既定のターン上限・**export は維持**）。
  - `export function simulate(strategy1, strategy2): SimulationResult`
    （現在 config 引数なし）。本体ループは `for (let turn = 1; turn <= MAX_TURNS; turn++)`。
    決着が付かなければ `endReason = "TIMEOUT"`、`totalTurns = turns.length`。
- `server.ts`:
  - `runMatch(matchId, p1, p2, strategy1, strategy2)` 内で
    `const result = simulate(strategy1 as Strategy, strategy2 as Strategy);`。
    **ルームや rulePreset はロードしていない。**
  - `coding_lock` ハンドラが両者ロック後に `runMatch(...)` を呼ぶ。直前に
    `prisma.match.findUnique({ where:{id}, select:{ player1Id, player2Id, strategy1, strategy2 }})`
    で `fresh` を取得している（ここに room を足せる）。
- ルーム設定（`/admin/rooms/:id/settings`, PR #19）は `rulePreset` を round-trip
  しており、`maxTurns`（既定 20）を含む（`prisma.room.rulePreset` は `Json`）。

## 3. 実装

### 3.1 `simulate()` に config を追加（非破壊）
```ts
export interface SimulateOptions { maxTurns?: number }

export function simulate(
  strategy1: Strategy | null | undefined,
  strategy2: Strategy | null | undefined,
  options?: SimulateOptions,
): SimulationResult {
  const maxTurns = normalizeMaxTurns(options?.maxTurns); // 下記
  // ...
  for (let turn = 1; turn <= maxTurns; turn++) { ... }
}
```
- `normalizeMaxTurns(v)`: 正の整数のみ採用、範囲は安全側にクランプ
  （例 `1..200`、未指定/不正は `MAX_TURNS`）。純関数として切り出すと
  テストしやすい。
- 既存の `MAX_TURNS` export はそのまま（既定値として使用）。第3引数は任意
  なので**既存の呼び出し・既存テストは無改変で通る**こと。

### 3.2 `server.ts` で rulePreset.maxTurns を渡す
- `runMatch` がルームの `rulePreset` を参照できるようにする。最小変更案:
  `coding_lock` の `fresh` 取得 select に
  `room: { select: { rulePreset: true } }` を足し、`runMatch` に
  `rulePreset`（または `maxTurns`）を渡す。あるいは `runMatch` 内で
  `prisma.match.findUnique({ where:{id:matchId}, select:{ room:{ select:{ rulePreset:true }}}})`
  を引いてもよい。
- `rulePreset` は `Json` なので**防御的に**読む:
  `const mt = (rulePreset as { maxTurns?: unknown } | null)?.maxTurns;`
  → 数値として妥当なら `simulate(s1, s2, { maxTurns: Number(mt) })`、
  でなければ `simulate(s1, s2)`（既定）。
- `server.ts` のブート構成・Socket 配線は変更しない。

## 4. テスト（必須・ここが本タスクの検証手段）

`src/lib/match-simulator.test.ts` を拡張（または新規 describe 追加）:
- `simulate(s1, s2, { maxTurns: 3 })` のように小さい上限を渡すと、
  決着しない戦略では `result.totalTurns === 3` かつ `endReason === "TIMEOUT"`。
- `maxTurns` 未指定なら従来どおり（既定 20 で動作）。
- `normalizeMaxTurns` の純関数テスト（0/負/NaN/巨大値→クランプ or 既定）。
- 既存 9 ケースが**そのまま green** であること。
- 既存テストが「HP_ZERO を踏まない（盤面の都合）」点は踏襲（むやみに変えない）。

`server.ts` 側は単体テストが難しいので、ロジックを純関数
（例 `resolveMaxTurns(rulePreset): number`）に切り出して vitest で
カバーすると堅い（任意だが推奨）。

## 5. 完了条件

- `tsc` / `lint` / `npm test`（既存 + 追加）/ `build` すべて green。
- PR 本文: 概要 / `simulate` シグネチャ変更（後方互換）/ server の読み取り /
  テスト / 「他 ruleset 項目は post-v0.2」と明記。
- ブラウザ確認は不要（ユニットテストで検証）。

## 6. 衝突回避

- Claude は `*.test.ts`（route handler テスト）中心で、`match-simulator.ts` /
  `server.ts` には触れていない。とはいえ作業前後に `main` を rebase すること。
- `simulate()` の**シグネチャは後方互換**（第3引数 optional）に保ち、
  既存の呼び出し側（battle/watch 等が参照する型）を壊さない。
