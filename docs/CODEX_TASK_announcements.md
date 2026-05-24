# Codex 作業指示: ルームお知らせ機能 (Announcements)

> このファイルは Codex への作業依頼書です。Claude Code は別ブランチ
> (`claude/v0.2-implementation-handoff-ZapvB`) で並行作業しています。
> **着手前に必ず `AGENTS.md` / `docs/HANDOFF.md` / `docs/ROADMAP.md` /
> `docs/STATUS.md` を読んでください。** 本ファイルはその上での個別タスク定義です。

## 0. ブランチ / ワークフロー

- 作業ブランチ: **`codex/v0.2-announcements`**（`main` から作成）。Claude の
  ブランチには絶対に push しないこと。
- `main` には直接 push しない。完了したら **PR（ドラフトではない）** を作成。
- push 前に `npx tsc --noEmit` と `npm run lint` を通すこと。CI
  (`.github/workflows/ci.yml`) は lint / tsc / build を実行する。
- push 後に `docs/STATUS.md` を更新（"Latest" を差し替え、旧 Latest は
  "History" へ1行で移動、"Next" を更新）。意味のある区切りで
  `docs/HANDOFF.md`（§1 のルート一覧、§4 のモック残り）も更新する。
- **このリポジトリの Next.js は破壊的変更版**。`node_modules/next/dist/docs/`
  と既存コードの規約に従う。特に: 動的 route の `params` は
  `Promise<{ ... }>`（`await` する）、route handler は
  `NextRequest`/`NextResponse`。リアルタイムは `tsx watch server.ts`。

## 1. このタスクの全体像

学習用タンク対戦ゲームの **ルームお知らせ機能** を「モデル→API→管理UI→
学習者向け表示」まで縦に1枚で仕上げる。`Announcement` モデルは既に存在する
（スキーマ変更不要、ただし監査アクション追加は任意で下記参照）。現状、
学習者のルームページのお知らせは **モック** で、管理者が投稿する手段が無い。

### スコープ内（やること）
1. **管理 CRUD API** — `/api/admin/rooms/[id]/announcements`
2. **学習者向け取得 API** — `/api/rooms/[roomNumber]/announcements`
3. **管理 UI** — 新規ページ `src/app/admin/rooms/[roomId]/announcements/page.tsx`
   （各ルーム管理ページの `ROOM_NAV` に「お知らせ」を追加）
4. **学習者ルームページの配線** — `src/app/rooms/[roomNumber]/page.tsx` の
   お知らせ欄をモックから実 API へ

### スコープ外（やらないこと）
- 学習者ルームページの **「あなたの予定」(schedule) ブロック** — データソースが
  未定（今後の上流マッチ/締切？要プロダクト判断）。モックのまま残す。
- お知らせの既読管理・通知・メール送信。
- ルーム設定など他機能。

## 2. データモデル（既存・変更不要）

`prisma/schema.prisma`:

```prisma
model Announcement {
  id        String   @id @default(cuid())
  roomId    String?
  title     String
  body      String
  pinned    Boolean  @default(false)
  authorId  String?
  createdAt DateTime @default(now())
}
```

注意: `Announcement` には Room / User へのリレーションが張られていない
（`roomId` / `authorId` はスカラのみ）。著者名が必要なら `authorId` で
`prisma.user.findMany` を別途引くか、リレーションを足してもよい（足す場合は
`Room.announcements` / `User` 側も対応し migration を作成）。**最小実装では
スカラ参照 + 著者の別引きで十分。**

### 監査ログ（任意・推奨）
`AuditAction` enum に現状 announcement 用アクションは無い。監査を残すなら
`ANNOUNCEMENT_CREATE` / `ANNOUNCEMENT_DELETE`（必要なら `_UPDATE`）を enum に
追加して `prisma migrate` / `prisma generate` する（スキーマ変更）。
コストを避けたい場合は v0.2 では監査省略でも可。判断は Codex に委ねる
（省略する場合は STATUS にその旨を明記）。

## 3. API 仕様

既存ルートの認可・形を踏襲すること。雛形:
- 管理系の認可・ROOM_ADMIN の自室チェック →
  `src/app/api/admin/rooms/[id]/members/route.ts` と
  `.../matches/route.ts`（`getSession` / `isAdmin` / 自室 `admins.some`）。
- 学習者系のアクセス制御 → `src/app/api/rooms/[roomNumber]/route.ts`
  （`getSession` → room 取得 → SYSTEM_ADMIN / 自室 ROOM_ADMIN / 当該ルームの
  ACTIVE membership のいずれかを許可。`watchingPublic` 等の公開ルールは
  既存 route に倣う）。
- 監査は `src/lib/audit.ts` の `logAudit(...)`。

### 3.1 管理: `/api/admin/rooms/[id]/announcements/route.ts`
- `GET` — そのルームのお知らせ一覧。**pinned 降順 → createdAt 降順**。
  著者表示名を含めて返す。`isAdmin` 必須、ROOM_ADMIN は自室のみ。
  返却例: `{ announcements: [{ id, title, body, pinned, createdAt,
  authorId, authorName }] }`。
- `POST` — 作成。body `{ title, body, pinned? }`。`title`/`body` 必須
  （空ならば 400）。`roomId = id`、`authorId = session.id` を保存。
  作成した announcement を返す（201）。監査 `ANNOUNCEMENT_CREATE`（任意）。

### 3.2 管理: `/api/admin/rooms/[id]/announcements/[announcementId]/route.ts`
- `PATCH` — `{ pinned?, title?, body? }` を部分更新（最低限 pinned トグル）。
  対象が当該ルームに属することを確認（属さなければ 404）。
- `DELETE` — 削除。同上の所属チェック。監査 `ANNOUNCEMENT_DELETE`（任意）。

### 3.3 学習者: `/api/rooms/[roomNumber]/announcements/route.ts`
- `GET` — `roomNumber` からルームを引き、アクセス可否を
  `src/app/api/rooms/[roomNumber]/route.ts` と同じ規則で判定。
  許可されたら pinned 降順 → createdAt 降順で返す
  （`{ announcements: [{ id, title, body, pinned, createdAt, authorName }] }`）。

## 4. 管理 UI: `src/app/admin/rooms/[roomId]/announcements/page.tsx`

- 既存のルーム管理ページ（`members` / `matches` / `standings` / `settings`）
  と同じ骨格: `"use client"` + `TopbarAdmin` + `ScopeBanner` +
  `AdminSidenav`（`scope="room"`）。ルーム名/番号は API（GET 一覧のレスポンス
  か `/api/admin/rooms/:id`）から取得して `AdminSidenav` に渡す。
- `ROOM_NAV` 配列に「お知らせ」項目を追加する。**この配列は各ルーム管理
  ページにコピーされている**（overview/members/matches/standings/settings）。
  全ページに同じ項目を足すこと。⚠️ Claude が `matches/page.tsx` を同時編集中
  なので、`main` に rebase してから matches ページの `ROOM_NAV` 追記を
  再適用すること（コンフリクトは1行追加なので軽微）。
  追加例: `{ label: "お知らせ", href: \`/admin/rooms/${roomId}/announcements\`, icon: "📢" }`
  （位置は「成績」と「設定」の間が自然）。
- 機能: 一覧表示（pinned 強調）、作成モーダル（title/body/pinned）、
  ピン留めトグル、削除（確認付き）。既存ページの作法に合わせ、
  busy/disabled・inline error・loading/error/empty 状態を必ず用意。
  ミューテーション後は一覧を再取得。
- スタイルは既存ページ同様インラインの CSS 変数（`var(--admin-accent)` 等）。
  新しいデザインを発明しない。

## 5. 学習者ルームページの配線

`src/app/rooms/[roomNumber]/page.tsx`:
- 先頭付近のモック定数 `ANNOUNCEMENTS`（約 70 行目）を削除し、
  `GET /api/rooms/:roomNumber/announcements` から取得した実データに置換。
- 既存の描画（約 337–351 行目の「📢 お知らせ」セクション）が期待する形:
  `title` / `body` / `author`（=`authorName`）/ `time`（相対表記）/ `pinned`。
  `time` は `createdAt` からクライアント側で「N日前」等に整形する小関数を作る
  （既存 `daysUntil` の隣に置くと自然）。pinned は枠線色で強調済み。
- ⚠️ このファイルは共有。`main` に rebase して取り込む。Claude は基本
  触らない予定だが、念のため最小限の差分に留める。

## 6. 完了条件 / 検証

- `npx tsc --noEmit` クリーン、`npm run lint` で新規エラー無し、
  `npm run build` 成功。
- 既存テスト（`npm test`）が緑のまま（Vitest）。可能なら API の集計/整列を
  純関数に切り出して軽い unit test を足すと尚良い（必須ではない。リポジトリは
  route handler のテストを持たない方針）。
- ブラウザ確認はこのコンテナでは不可。data 配線・型・build まで検証し、
  PR 本文に「ブラウザ未検証」と明記する。
- PR 本文: 概要・各エンドポイント/ページ・テスト手順・既知の未検証点。

## 7. 衝突回避メモ

- Claude は `src/app/admin/rooms/[roomId]/matches/page.tsx`（トーナメント/総当たり
  ビュー）を編集中。**そのファイルには触れない**こと（`ROOM_NAV` 追記時のみ
  rebase で再適用）。
- 共有ファイル（学習者ルームページ、各 `ROOM_NAV`）は作業前に `main` を
  fetch して rebase。push 前にもう一度 rebase 推奨。
