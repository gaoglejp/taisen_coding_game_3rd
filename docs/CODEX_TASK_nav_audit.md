# Codex 作業指示 (第10弾): 画面遷移(ナビゲーション)の総点検と修正

> Claude Code は別ブランチで並行作業中。**着手前に `AGENTS.md` /
> `docs/HANDOFF.md` / `docs/ROADMAP.md` / `docs/STATUS.md` / `docs/TESTPLAY.md`
> を読むこと。** あなたは **CLI 実行環境**を持つ前提（アプリ起動 + Playwright で
> 実遷移を検証できる）。

## 0. ブランチ / ワークフロー
- 作業ブランチ: **`codex/v0.2-nav-audit`**（`main` から作成）。
- `main` / Claude のブランチへ直接 push しない。完了後 **PR（非ドラフト）**。
- push 前に `npx tsc --noEmit` / `npm run lint` / `npm test`(143) / `npm run build`。
- 可能なら **ローカルで Playwright を実走**して遷移 green を確認（CLI 活用）。
- push 後に `docs/STATUS.md` 更新、`docs/HANDOFF.md` に必要なら追記。

## 1. 背景・ゴール

手動テストプレイで壊れた画面遷移(リンク先 404)が複数見つかっている。
**全画面の遷移を体系的に棚卸し → 壊れを修正 → 回帰を E2E で防ぐ**。

### 既知の壊れた遷移(必ず対応・他にも探す)
ルート(`src/app/**/page.tsx`)が存在しないのにリンクされている:
1. **`/admin/system`** — 全システム管理ページの sidenav「ホーム」(例:
   `src/app/admin/system/{rooms,users,audit}/page.tsx` の `SYSTEM_NAV`)。**404**。
2. **`/admin/system/settings`** — 同 sidenav「設定」。ページ無し。**404**。
3. **`/admin`** — `src/app/error/[code]/page.tsx` の「管理」ボタン(2 箇所)。**404**。
4. **`/practice`** — `src/app/dashboard/page.tsx` の「🧩 練習する」。**404**(練習モード未実装)。

> `/rooms` のインデックス 404 は Claude が PR #53 で修正済み。**`/rooms` 系には
> 触れない**(衝突回避)。

## 2. 作業内容

### (A) 棚卸し（全件マトリクス）
`src/app` と `src/components` の **全ナビゲーション元**を洗い出す:
`href=`(`<Link>`/`<a>`)、`router.push`/`router.replace`、`redirect(`、
`<form action>`、`window.location` 等。動的(テンプレート)リテラルも含む。
それぞれの **遷移先 → 実ルートの有無 / 動的パラメータの整合 / 認可** を判定し、
**`docs/NAV_AUDIT.md`** に表でまとめる(列: 遷移元ファイル:行 / 遷移先 /
種別 / 実ルート有無 / 状態[OK/壊れ/要判断] / 対応)。

判定の足場:
- 実ルート一覧は `find src/app -name page.tsx`(動的は `[param]`)。
- 動的先のパラメータ整合に注意: 例 ルームは **`roomNumber`**(`/rooms/[roomNumber]`)
  であって id ではない。マッチは **`matchId`**。admin ルームは **`roomId`**(= 内部 id)。
  「id を渡すべき所に roomNumber」「roomNumber を渡すべき所に id」を取り違えていないか。
- 認可: `src/proxy.ts`(エッジ guard、matcher)とページ側 `getSession` の整合。
  特に **`/watch` は匿名可**(decision #11、matcher 除外済み)— 戻さない。

### (B) 修正(方針: 低リスク優先・新デザインを発明しない)
- **ホーム/着地系のリンク先がコンテンツを持たない場合 → リダイレクト**で実在ページへ:
  - `/admin/system` → `/admin/system/rooms`(システム管理の事実上のトップ)。
    `src/app/admin/system/page.tsx` を **redirect する Server Component**
    (`import { redirect } from "next/navigation"; export default function(){ redirect("/admin/system/rooms"); }`)で実装するのが簡単。
  - `/admin` → セッションのロールで分岐: SYSTEM_ADMIN は `/admin/system/rooms`、
    ROOM_ADMIN は自分の担当ルーム概要(担当が一意でなければ `/dashboard`)、
    それ以外は `/dashboard`。`src/app/admin/page.tsx` を `getSession` で
    判定して `redirect(...)` する Server Component に。
    （簡単化して全員 `/admin/system/rooms` でも可だが、ロール分岐が望ましい）
- **機能未実装の先(`/admin/system/settings`, `/practice`)**: 勝手に大きな機能を
  作らない。**いずれか**を選び、`docs/NAV_AUDIT.md` に理由を明記:
  - (推奨) 404 を避ける **最小「準備中」プレースホルダページ**を作る
    （既存のページ chrome [TopbarPaper/TopbarAdmin/AdminSidenav] を流用、
    本文は「この機能は準備中です」+ 戻るリンク）。**新デザインは発明しない**。
  - または該当 **nav 項目/ボタンを除去**（視覚変更になるので慎重に。除去理由を明記）。
  - 判断が割れるものは「要判断」として残し、勝手に作り込まない。
- **パラメータ取り違え**等の明確なバグは修正(最小差分)。

### (C) 回帰防止(E2E)
`e2e/`(PR #51 の Playwright)に **ナビゲーション・スモーク**を追加:
- 主要遷移を実クリックして **404 にならない**ことを assert:
  ダッシュボード「対戦ルームに入る」→ `/rooms` → 入室 → ルーム、
  ルーム → マッチ/コーディングへの導線、管理者: 各 admin ページの sidenav 全項目
  (ホーム/ルーム/アカウント/監査/設定 等)を踏んで 404 が無いこと、
  error ページの「管理」ボタン、等。seed アカウントで実施。
- ローカルで `npm run test:e2e` が green であることを CLI で確認してから push。

## 3. スコープ外
- `/rooms` インデックス(Claude 済み)。
- 大型の新機能実装(練習モード本体、システム設定機能本体)。プレースホルダ/リダイレクト/フラグまで。
- デザイン刷新。既存 17 プロトタイプの見た目は維持。

## 4. 完了条件
- `docs/NAV_AUDIT.md` に全遷移マトリクス(OK/壊れ/要判断 + 対応)。
- 既知の 4 件(`/admin/system`, `/admin/system/settings`, `/admin`, `/practice`)が
  404 にならない(リダイレクト or プレースホルダ or nav 除去のいずれか、理由明記)。
- 追加で見つかった壊れ/取り違えも修正 or 要判断として記録。
- E2E ナビ・スモーク追加、ローカルで green。`tsc`/`lint`/`npm test`/`build` 緑。
- PR 本文: 監査サマリ(壊れ件数/修正内容/要判断項目)+ 実行方法。

## 5. 衝突回避
- `/rooms` 系・`src/proxy.ts` の matcher(`/watch` 除外方針)は変更しない。
- Claude は別作業中。作業前後に `main` を rebase。新規/最小差分中心で。
