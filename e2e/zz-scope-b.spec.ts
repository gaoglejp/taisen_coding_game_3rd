import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const PASSWORD = "password123!";
const ROOM_NUMBER = "ROOM-2026-0001";

async function login(page: Page, username: string) {
  await page.goto("/login");
  await page.getByPlaceholder("username または email@example.com").fill(username);
  await page.getByPlaceholder("パスワード").fill(PASSWORD);
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

function extractCodingMatchId(page: Page): string {
  const match = page.url().match(/\/match\/([^/]+)\/coding$/);
  expect(match, `expected coding URL, got ${page.url()}`).not.toBeNull();
  return match![1];
}

async function openSeedCodingMatchViaRoom(page: Page): Promise<string> {
  await page.goto(`/rooms/${ROOM_NUMBER}`);
  await expect(page.getByRole("heading", { name: "プログラミング入門クラス" })).toBeVisible();

  // Fresh seed exposes exactly one active own match (#2, CODING) through the
  // room page. Derive the cuid by clicking the same "入室する" route a user uses.
  await page.getByRole("link", { name: "入室する" }).first().click();
  await expect(page).toHaveURL(/\/match\/[^/]+\/coding$/);
  return extractCodingMatchId(page);
}

async function confirmCode(page: Page) {
  await page.getByRole("button", { name: "コードを確定する" }).first().click();
  await expect(page.getByText("以下のストラテジーで対戦を開始します")).toBeVisible();
  await page.getByRole("button", { name: "確定する", exact: true }).click();
}

async function closeContexts(contexts: BrowserContext[]) {
  await Promise.all(contexts.map((context) => context.close().catch(() => {})));
}

test.describe("Scope B realtime smoke", () => {
  test("two students lock code, reach battle/result, and a watcher joins viewer_count", async ({ browser }) => {
    test.setTimeout(120_000);

    const taroContext = await browser.newContext();
    const hanakoContext = await browser.newContext();
    const watcherContext = await browser.newContext();
    const contexts = [taroContext, hanakoContext, watcherContext];

    try {
      const taro = await taroContext.newPage();
      const hanako = await hanakoContext.newPage();
      const watcher = await watcherContext.newPage();

      await login(taro, "taro_student");
      const matchId = await openSeedCodingMatchViaRoom(taro);

      // The live match can finish in only a few turns. Keep a battle page
      // subscribed before the second lock so the result-link assertion is not
      // sensitive to the app-route transition window after match_started.
      const taroBattle = await taroContext.newPage();
      await taroBattle.goto(`/match/${matchId}/battle`);
      const taroBattleResultLink = taroBattle.getByRole("link", { name: /結果へ/ });
      await expect(taroBattleResultLink).toBeVisible();

      await login(hanako, "hanako_student");
      await hanako.goto(`/match/${matchId}/coding`);
      await expect(hanako).toHaveURL(new RegExp(`/match/${matchId}/coding$`));
      await expect(hanako.getByRole("button", { name: "コードを確定する" }).first()).toBeVisible();

      // The watch page route is public, but the current Socket.io handshake
      // requires a session cookie. Log the watcher in via UI, then open /watch.
      await login(watcher, "sysadmin");
      await watcher.goto(`/watch/${matchId}`);
      await expect(watcher).toHaveURL(new RegExp(`/watch/${matchId}$`));
      await expect(watcher.getByLabel("観戦者数")).toHaveText(/[1-9]\d*/, { timeout: 10_000 });

      await confirmCode(taro);
      await expect(taro.getByText("相手の確定を待っています")).toBeVisible();
      await expect(hanako.getByText("相手 ✓ 確定済み")).toBeVisible();

      await confirmCode(hanako);
      await expect(taro).toHaveURL(new RegExp(`/match/${matchId}/battle$`), { timeout: 15_000 });
      await expect(hanako).toHaveURL(new RegExp(`/match/${matchId}/battle$`), { timeout: 15_000 });

      await expect(taroBattleResultLink).toHaveCSS("pointer-events", "auto", { timeout: 60_000 });

      await taroBattleResultLink.click();
      await expect(taroBattle).toHaveURL(new RegExp(`/match/${matchId}/result$`));

      await expect(taroBattle.getByText("ターンで決着がつきました。")).toBeVisible();
      await expect(taroBattle.getByText("HP残り").first()).toBeVisible();
      await expect(taroBattle.getByText("お探しのページは見つかりませんでした")).toHaveCount(0);
    } finally {
      await closeContexts(contexts);
    }
  });
});
