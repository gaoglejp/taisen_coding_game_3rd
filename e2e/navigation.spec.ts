import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "password123!";

async function login(page: Page, username: string, landing: RegExp = /\/dashboard$/) {
  await page.goto("/login");
  await page.getByPlaceholder("username または email@example.com").fill(username);
  await page.getByPlaceholder("パスワード").fill(PASSWORD);
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect(page).toHaveURL(landing);
}

async function expectNotFoundCopyAbsent(page: Page) {
  await expect(page.getByText("お探しのページは見つかりませんでした")).toHaveCount(0);
}

test.describe("navigation smoke", () => {
  test("student dashboard, rooms, practice, coding, and replay links do not land on 404", async ({ page }) => {
    await login(page, "taro_student");

    await page.getByRole("link", { name: /対戦ルームに入る/ }).click();
    await expect(page).toHaveURL(/\/rooms$/);
    await expect(page.getByRole("heading", { name: /対戦ルーム/ })).toBeVisible();
    await expectNotFoundCopyAbsent(page);

    await page.getByRole("link", { name: "入室する" }).first().click();
    await expect(page).toHaveURL(/\/rooms\/ROOM-2026-0001$/);
    await expect(page.getByRole("heading", { name: "プログラミング入門クラス" })).toBeVisible();
    await expectNotFoundCopyAbsent(page);

    await page.getByRole("link", { name: "入室する" }).first().click();
    await expect(page).toHaveURL(/\/match\/[^/]+\/coding$/);
    await expectNotFoundCopyAbsent(page);

    await page.goto("/dashboard");
    await page.getByRole("link", { name: /練習する/ }).click();
    await expect(page).toHaveURL(/\/practice$/);
    await expect(page.getByRole("heading", { name: "ソロバトル" })).toBeVisible();
    await expectNotFoundCopyAbsent(page);

    await page.goto("/dashboard");
    await page.getByRole("link", { name: "再生" }).first().click();
    await expect(page).toHaveURL(/\/watch\/[^/]+$/);
    await expectNotFoundCopyAbsent(page);
  });

  test("system admin sidenav entries and /admin redirect do not land on 404", async ({ page }) => {
    await login(page, "sysadmin", /\/admin\/system\/rooms$/);

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/system\/rooms$/);
    await expectNotFoundCopyAbsent(page);

    // The dashboard guard bounces an admin off the player home.
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/admin\/system\/rooms$/);
    await expectNotFoundCopyAbsent(page);

    const systemNav = page.getByRole("navigation");

    await systemNav.getByRole("link", { name: /ホーム/ }).click();
    await expect(page).toHaveURL(/\/admin\/system\/rooms$/);
    await expectNotFoundCopyAbsent(page);

    await systemNav.getByRole("link", { name: /アカウント/ }).click();
    await expect(page).toHaveURL(/\/admin\/system\/users$/);
    await expectNotFoundCopyAbsent(page);

    await systemNav.getByRole("link", { name: /監査ログ/ }).click();
    await expect(page).toHaveURL(/\/admin\/system\/audit$/);
    await expectNotFoundCopyAbsent(page);

    await systemNav.getByRole("link", { name: /設定/ }).click();
    await expect(page).toHaveURL(/\/admin\/system\/settings$/);
    await expect(page.getByRole("heading", { name: "システム設定" })).toBeVisible();
    await expectNotFoundCopyAbsent(page);

    await systemNav.getByRole("link", { name: /ルーム/ }).click();
    await expect(page).toHaveURL(/\/admin\/system\/rooms$/);
    await expectNotFoundCopyAbsent(page);
  });

  test("room admin /admin redirect lands on the assigned room overview", async ({ page }) => {
    await login(page, "teacher01", /\/admin\/rooms\/[^/]+$/);

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/rooms\/[^/]+$/);
    await expect(page.getByRole("heading", { name: "プログラミング入門クラス" })).toBeVisible();
    await expectNotFoundCopyAbsent(page);
  });

  test("room admin sidenav entries do not land on 404", async ({ page }) => {
    await login(page, "teacher01", /\/admin\/rooms\/[^/]+$/);

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/rooms\/[^/]+$/);

    const roomNav = page.getByRole("navigation");

    await roomNav.getByRole("link", { name: /メンバー/ }).click();
    await expect(page).toHaveURL(/\/admin\/rooms\/[^/]+\/members$/);
    await expectNotFoundCopyAbsent(page);

    await roomNav.getByRole("link", { name: /マッチカード/ }).click();
    await expect(page).toHaveURL(/\/admin\/rooms\/[^/]+\/matches$/);
    await expectNotFoundCopyAbsent(page);

    await roomNav.getByRole("link", { name: /成績/ }).click();
    await expect(page).toHaveURL(/\/admin\/rooms\/[^/]+\/standings$/);
    await expectNotFoundCopyAbsent(page);

    await roomNav.getByRole("link", { name: /お知らせ/ }).click();
    await expect(page).toHaveURL(/\/admin\/rooms\/[^/]+\/announcements$/);
    await expectNotFoundCopyAbsent(page);

    await roomNav.getByRole("link", { name: /設定/ }).click();
    await expect(page).toHaveURL(/\/admin\/rooms\/[^/]+\/settings$/);
    await expectNotFoundCopyAbsent(page);

    await roomNav.getByRole("link", { name: /概要/ }).click();
    await expect(page).toHaveURL(/\/admin\/rooms\/[^/]+$/);
    await expectNotFoundCopyAbsent(page);
  });

  test("error page management actions resolve through the admin landing route", async ({ page }) => {
    await login(page, "sysadmin", /\/admin\/system\/rooms$/);

    await page.goto("/error/403-admin");
    await page.getByRole("link", { name: /管理ホーム/ }).click();
    await expect(page).toHaveURL(/\/admin\/system\/rooms$/);
    await expectNotFoundCopyAbsent(page);

    await page.goto("/error/403-admin");
    await page.getByRole("link", { name: /監査ログを見る/ }).click();
    await expect(page).toHaveURL(/\/admin\/system\/rooms$/);
    await expectNotFoundCopyAbsent(page);
  });
});
