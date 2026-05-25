# テストプレイ手順書 (v0.2 通し確認)

このドキュメントは **v0.2 の一周を実ブラウザ/実 DB で通しで確認**するための手順です。
これまでの実装は「配線済み＋ユニットテスト済み」ですが、ブラウザでの通し検証は
未実施のため、最終確認はここに沿って手動で行います（仕様理解者 = Claude/人間）。

> 結論: この一周に **招待コード / 2FA / メール確認 / lastTurn / 真ブラケット /
> 障害物・アイテム は不要**です。seed が用意するアカウントとマッチで完結します。

## 0. 前提

- Node.js（リポジトリの `package.json` に準拠）, Docker（Postgres 用。ローカル
  Postgres があれば不要）。
- リアルタイム対戦は **カスタム `server.ts`**（Next + Socket.io を同一ポートで起動）。
  `next dev` ではなく `npm run dev`（= `tsx watch server.ts`）を使う。

## 1. セットアップ

```bash
# 1) 環境変数（既定値で OK。無ければ example をコピー）
cp -n .env.example .env   # DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/taisen_coding

# 2) Postgres 起動（docker。ローカル Postgres を使うなら省略）
docker compose up -d postgres

# 3) 依存インストール
npm install

# 4) スキーマ反映 + シードデータ投入
npm run db:push
npm run db:seed     # アカウント / ルーム / メンバー / マッチ(FINISHED + CODING) を作成

# 5) 起動（Next + Socket.io が http://localhost:3000）
npm run dev
```

`db:seed` のログに以下が出る（プレイに使う）:

- System admin: `sysadmin` / `password123!`
- Room admin: `teacher01` / `password123!`
- Student 1: `taro_student` / `password123!`
- Student 2: `hanako_student` / `password123!`
- `Match ID (finished)` … 結果/順位/リプレイ確認用（matchNumber 1, taro 勝利）
- `Match ID (coding)` … **生対戦フロー確認用**（matchNumber 2, taro vs hanako, 期限 +5分）

> 注: seed の FINISHED マッチには `replayData` が入っていないため、結果画面の
> ダメージ等の集計値は 0/空になる。実際の集計は下の「生対戦」を一周すると
> 生成される（その後に新しい結果画面で数値が出る）。

## 2. 通しシナリオ

ブラウザを **3 つの独立セッション**（別ブラウザ or プロファイル or シークレット
ウィンドウ）で用意すると観戦まで一度に確認できる。

### A. 管理者 (teacher01)
1. `http://localhost:3000/login` → `teacher01` でログイン。
2. ルーム管理を開く（ダッシュボード or `/admin/rooms/<roomId>`）。
   - **概要**: アクティビティ（監査ログ由来）が出る。
   - **メンバー**: taro / hanako が ACTIVE。発行/再発行/無効化のモーダルが動く。
   - **マッチカード**: 一覧 / 総当たり / トーナメント表示。「＋作成」で
     メンバーを選んで発行 → 一覧に増える。
   - **成績**: 期間フィルタ、ドリルダウン。
   - **設定**: ルーム設定（`maxTurns` を変えると次の対戦のターン上限に反映）。
   - **お知らせ**: 作成 → 学生のルームページに出る。

### B. 学生2人 (taro_student / hanako_student) — 生対戦
1. それぞれ別セッションでログイン。
2. 両者で `http://localhost:3000/match/<coding match id>/coding` を開く。
   - 左の Blockly エディタでルール（条件→アクション）を組む。右「JSONプレビュー」で
     生成 JSON を確認。カウントダウンは `codingDeadlineAt`（+5分）から算出される。
3. 両者が「コードを確定」→ 両ロックでサーバが simulate → 自動で
   `…/battle` に遷移し、ターン再生（HP / 位置 / ログ）が流れる。
4. 決着すると結果画面（`…/result`）へ。勝敗・統計が表示される。

### C. 観戦 (任意 / sysadmin or 第三者)
1. `http://localhost:3000/watch/<match id>` を開く。
2. 対戦中なら盤面・プレイヤーパネル・**観戦者数**（タブを増やすと増減）・
   タイムライン（命中で増える）を確認。終了後はリプレイ。

### D. ルームハブ (学生視点)
1. 学生で `http://localhost:3000/rooms/<roomNumber>` を開く。
2. ヒーロー / マッチ一覧 / 順位 / **あなたの予定**（自分の進行中マッチ）/ お知らせ が
   実データで出る。

## 3. 確認チェックリスト（最終確認の観点）

- [ ] 4 ロールでログインでき、役割に応じた画面に着地する
- [ ] 管理者がルーム/メンバー/マッチ/お知らせを操作でき、結果が即反映される
- [ ] 学生2人が**異なる戦略**を Blockly で組んで lock でき、対戦結果に反映される
      （`maxTurns` 設定が効く / 戦略差で勝敗が変わる）
- [ ] battle 再生・result・watch（観戦者数/タイムライン）が実データで動く
- [ ] ルームページの予定/順位/お知らせが実データ
- [ ] コンソール/サーバログに致命的エラーが出ない

## 4. トラブルシュート

- DB 接続エラー: `docker compose ps` で postgres が up か、`.env` の `DATABASE_URL` を確認。
- ポート競合: 3000 番が空いているか（他プロセス停止）。
- リアルタイムが来ない: `npm run dev`（`tsx watch server.ts`）で起動しているか
  （`next dev` だと Socket.io が無い）。
- データを作り直す: `npm run db:push` → `npm run db:seed`（seed は upsert で冪等）。

## 5. 自動化との関係

この手動手順を **Playwright E2E** で自動化していく（Codex 担当、まず
ログイン〜着地のスモークから／`docs/CODEX_TASK_e2e_smoke.md`）。手動の最終確認は
仕様理解者が本書で行い、回帰防止の自動スモークは E2E で担保する分担。
