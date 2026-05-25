# Codex 作業指示 (第5弾): コーディング画面のカウントダウンを実期限に接続

> Claude Code は別ブランチ (`claude/v0.2-implementation-handoff-ZapvB`) で
> 並行作業中（route handler テスト中心）。**着手前に `AGENTS.md` /
> `docs/HANDOFF.md` / `docs/ROADMAP.md` / `docs/STATUS.md` を読むこと。**
> 直前の maxTurns 反映 (PR #40) はマージ済み。

## 0. ブランチ / ワークフロー

- 作業ブランチ: **`codex/v0.2-coding-deadline-timer`**（`main` から作成）。
- `main` / Claude のブランチへ直接 push しない。完了後に **PR（非ドラフト）**。
- push 前に `npx tsc --noEmit` / `npm run lint` / `npm test` / `npm run build`。
- push 後に `docs/STATUS.md`（Latest 差し替え・History 1行・Next 更新）、必要に応じ
  `docs/ROADMAP.md`（Milestone A）を更新。
- Next.js 破壊的変更版。`server.ts` のブート構成は変えない。

## 1. 全体像（player-facing・**純関数ユニットテストで検証可能**）

コーディング画面のカウントダウンが **ハードコードの 300 秒** で、マッチの実際の
コーディング期限 `codingDeadlineAt` を無視している。これを実期限に接続する。

### スコープ内
1. コーディング画面の残り時間を、マッチの `codingDeadlineAt`（`/api/match/:id/state`
   が既に返す）から算出する。
2. 期限切れ時の挙動（既存の expired UI/モーダル）はそのまま活かす。
3. 残り秒数の算出を**純関数に切り出してユニットテスト**を追加。

### スコープ外（やらない）
- `server.ts` への新規 socket emit 追加（`coding_start` 受信は任意・下記）。
- コーディングロジック/Blockly エディタ本体の変更。
- ルームの `codingTimeLimitSec` 設定→`codingDeadlineAt` 生成側の変更
  （マッチ作成時に既に設定される。今回は表示側のみ）。

## 2. 既存の足場（確認済み）

- `src/app/match/[matchId]/coding/page.tsx`:
  - `const [timeLeft, setTimeLeft] = useState(300);`（ハードコード）。
  - `useEffect` 内 `setInterval` で毎秒 `setTimeLeft((t)=>...)` 減算。
  - `formatTime(seconds)` 表示、`expired = timeLeft <= 0`、残り時間で色変化、
    タイムアウト用モーダルあり（既存挙動）。
  - ページはマウント時に `/api/match/:id/state` 等を fetch 済み（PR #8 でヘッダ配線）。
- `GET /api/match/[matchId]/state` は `match.codingDeadlineAt`（`DateTime?`）を
  返す（select 済み）。
- 先頭に `// <!-- bind: WS recv coding_start { codingDeadlineAt } -->` のメモあり。
- 注意: `codingDeadlineAt` は **null のことがある**（マッチ作成時に startDeadline
  未指定だと未設定）。

## 3. 実装

1. **純関数**（例 `src/lib/coding-timer.ts` か coding ページ内）:
   ```ts
   export function secondsUntil(deadlineIso: string | null | undefined, now: number = Date.now()): number | null {
     if (!deadlineIso) return null;
     const t = new Date(deadlineIso).getTime();
     if (Number.isNaN(t)) return null;
     return Math.max(0, Math.ceil((t - now) / 1000));
   }
   ```
2. **コーディングページ**:
   - `/state` レスポンスの `match.codingDeadlineAt` を state に保持。
   - 初期 `timeLeft` と毎秒の更新を、`secondsUntil(codingDeadlineAt)` から算出する
     方式へ変更（`setInterval` 内で都度 `secondsUntil` を再評価すると、タブ復帰時の
     ドリフトも防げる）。
   - `codingDeadlineAt` が **null の場合は従来どおり 300 秒のローカルカウントダウン**
     にフォールバック（挙動を壊さない）。
   - 0 到達時は既存の expired/タイムアウト挙動を維持。
   - （任意）socket の `coding_start { codingDeadlineAt }` を受信したら deadline を
     更新する購読を足してよい（サーバが emit していなければ no-op で害なし。
     **サーバ側の emit 追加はしない**）。
3. デザイン・レイアウトは現状維持（表示する数値のソースを変えるだけ）。

## 4. テスト（必須・検証手段）

- `secondsUntil` の純関数テスト（`src/lib/coding-timer.test.ts` 等）:
  - 未来の deadline → 正の秒数（`now` を固定して決定的に）。
  - 過去の deadline → `0`。
  - `null` / 不正文字列 → `null`。
  - 端数の切り上げ（`Math.ceil`）。
- 既存テスト（104）が green のままであること。

## 5. 完了条件

- `tsc` / `lint` / `npm test` / `build` 緑。
- ブラウザ確認はコンテナ不可。PR に「タイマー実挙動はブラウザ未検証（手動: 期限付き
  マッチでカウントダウンが実期限に一致するか）」と明記。純関数はテスト済みである旨も。
- PR 本文: 概要 / 変更点 / フォールバック方針（null→300）/ テスト。

## 6. 衝突回避

- Claude は `*.test.ts`（route handler テスト）中心で、コーディングページや
  `server.ts` には触れていない。作業前後に `main` を rebase。
- `coding/page.tsx` は Blockly エディタ (#23) を含む大きめファイル。タイマー周辺
  （`timeLeft` / `useEffect` / `/state` fetch）の最小差分に留めること。
