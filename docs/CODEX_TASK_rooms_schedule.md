# Codex 作業指示 (第6弾): ルームの「あなたの予定」を実データ化

> Claude Code は別ブランチ (`claude/v0.2-implementation-handoff-ZapvB`) で
> 並行作業中。**着手前に `AGENTS.md` / `docs/HANDOFF.md` / `docs/ROADMAP.md` /
> `docs/STATUS.md` を読むこと。** 直前のコーディングタイマー (PR #42) は
> マージ済み。

## 0. ブランチ / ワークフロー

- 作業ブランチ: **`codex/v0.2-rooms-schedule`**（`main` から作成）。
- `main` / Claude のブランチへ直接 push しない。完了後に **PR（非ドラフト）**。
- push 前に `npx tsc --noEmit` / `npm run lint` / `npm test` / `npm run build`。
- push 後に `docs/STATUS.md`（Latest 差し替え・History 1行）、`docs/ROADMAP.md`
  （Milestone C「Your schedule」行）を更新。
- Next.js 破壊的変更版。

## 1. 全体像（player-facing・データは既に取得済み）

学習者のルームページ `src/app/rooms/[roomNumber]/page.tsx` の
**「あなたの予定」セクションがモックのまま**（最後に残ったこのページのモック）。
これを実データ化して **Milestone C を完了**させる。

> 📌 **暫定の定義（プロダクト確認を仰ぐ前提）**: 「あなたの予定」=
> 「**このルームで自分が参加している進行中/未開始のマッチ**」とする。
> マッチには時刻ベースの汎用スケジュールが無いため、各マッチの
> `codingDeadlineAt`（コーディング期限）を予定時刻として扱う。将来、専用の
> スケジュール源が定義されたら差し替え可能なように実装する。
> PR 本文と STATUS に「暫定定義」と明記すること。

### スコープ内
1. 「あなたの予定」を、**既にページが取得している** `matches` + `meId` から導出して描画。
2. 新規エンドポイントや新規 fetch は不要（データは取得済み）。

### スコープ外
- マッチ API の変更、新しい「予定」モデル/エンドポイントの追加。
- 終了済みマッチの履歴表示（別物）。
- 専用スケジュール機能（時間割等）— 未定義（post-v0.2 / 要プロダクト判断）。

## 2. 既存の足場（確認済み）

`src/app/rooms/[roomNumber]/page.tsx`:
- `const [meId, setMeId] = useState<string | null>(null);`（`/api/me` から設定済み）。
- `const [matches, setMatches] = useState<ApiMatch[]>([]);`
  （`GET /api/rooms/:roomNumber/matches` から設定済み）。
- マッチ一覧描画で既に
  `const isMyMatch = !!meId && (m.player1?.id === meId || m.player2?.id === meId);`
  を使用（自分のマッチ判定ロジックは既にある）。
- `ApiMatch` 型は現状 `{ id, matchNumber, status, player1, player2 }`
  （`player1/player2` は `{ id, username, displayName } | null`）。
- 既存の日時整形ヘルパ（`formatRelativeDate` 等）あり。
- `// "あなたの予定" (schedule) is still intentionally mock-only` のコメント
  （68行目付近）と、対応するモック描画ブロックがある。

`GET /api/rooms/:roomNumber/matches` は **status が WAITING/CODING/BATTLING の
マッチのみ**返し、各マッチに `matchNumber` / `status` / `codingDeadlineAt` /
`player1` / `player2`（いずれも id 付き）を含む。→ 予定に必要な情報は揃っている。

## 3. 実装

1. `ApiMatch` 型に `codingDeadlineAt?: string | null` を追加（API は返している）。
2. 「あなたの予定」を導出:
   ```ts
   const mySchedule = matches
     .filter((m) => !!meId && (m.player1?.id === meId || m.player2?.id === meId))
     .sort((a, b) => {
       const ta = a.codingDeadlineAt ? Date.parse(a.codingDeadlineAt) : Infinity;
       const tb = b.codingDeadlineAt ? Date.parse(b.codingDeadlineAt) : Infinity;
       return ta - tb || a.matchNumber - b.matchNumber;  // 期限早い順、null は末尾
     });
   ```
   （API が既に active のみ返すので status フィルタは不要だが、防御的に
   FINISHED/CANCELED を除外してもよい。）
3. モック描画を上記 `mySchedule` の描画に置換。各項目に:
   - マッチ番号（`#${m.matchNumber}`）、対戦相手名（自分でない側の displayName
     ?? username、未定なら「募集中」）、status バッジ、期限
     （`codingDeadlineAt` を既存ヘルパで整形。null は「期限なし」）。
   - 行クリック/CTA のリンク先: `WAITING`/`CODING` → `/match/${m.id}/coding`、
     `BATTLING` → `/watch/${m.id}`。
   - **空状態**: 自分の予定が無いとき「参加予定のマッチはありません」等。
4. デザインは既存ページのトーンに合わせる（新デザインを発明しない）。既存の
   「あなたの予定」枠のスタイルを流用。

## 4. テスト / 検証

- ロジック（フィルタ＋ソート）を**純関数に切り出して vitest**を追加すると堅い
  （例 `selectMySchedule(matches, meId)` を `src/lib/room-schedule.ts` に置く）。
  未来/null 期限の並び、自分のマッチのみ抽出、を決定的にテスト。
- 既存テスト（109）が green のまま。
- ブラウザ確認はコンテナ不可。PR に「表示はブラウザ未検証（純関数はテスト済み）」と明記。

## 5. 完了条件

- `tsc` / `lint` / `npm test` / `build` 緑。
- PR 本文: 概要 / **「あなたの予定」の暫定定義** / 変更点 / テスト / 未検証点。
- ROADMAP Milestone C「Your schedule」を ✅（暫定定義つき）に更新。

## 6. 衝突回避

- Claude は `*.test.ts`（route handler テスト）中心で、ルームページには
  触れていない。`src/app/rooms/[roomNumber]/page.tsx` は Codex が announcements
  (#31) で触ったページ。作業前後に `main` を rebase。最小差分で。
