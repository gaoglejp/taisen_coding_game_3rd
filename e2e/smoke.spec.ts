import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "password123!";
const ROOM_NUMBER = "ROOM-2026-0001";

type SeedAccount = {
  username: string;
  displayName: string;
  roleLabel: string;
};

const studentAccounts: SeedAccount[] = [
  { username: "taro_student", displayName: "たろう", roleLabel: "ROOM USER" },
  { username: "hanako_student", displayName: "はなこ", roleLabel: "ROOM USER" },
];

async function login(page: Page, username: string, landing: RegExp = /\/dashboard$/) {
  await page.goto("/login");
  await page.getByPlaceholder("username または email@example.com").fill(username);
  await page.getByPlaceholder("パスワード").fill(PASSWORD);
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect(page).toHaveURL(landing);
}

test.describe("Scope A smoke", () => {
  for (const account of studentAccounts) {
    test(`${account.username} logs in and lands on the player dashboard`, async ({ page }) => {
      await login(page, account.username);

      await expect(page.getByText(`@${account.username}`)).toBeVisible();
      await expect(
        page.getByRole("heading", { name: `おかえりなさい、${account.displayName}さん` })
      ).toBeVisible();
      await expect(
        page.getByRole("banner").getByText(account.roleLabel, { exact: true })
      ).toBeVisible();
    });
  }

  test("system admin logs in and lands on the system rooms console", async ({ page }) => {
    await login(page, "sysadmin", /\/admin\/system\/rooms$/);
    await expect(page.getByRole("heading", { name: "ルーム", exact: true })).toBeVisible();
  });

  test("room admin logs in and lands on their assigned room overview", async ({ page }) => {
    await login(page, "teacher01", /\/admin\/rooms\/[^/]+$/);
    await expect(page.getByRole("heading", { name: "プログラミング入門クラス" })).toBeVisible();
  });

  test("protected pages redirect unauthenticated users to login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("button", { name: "ログイン" })).toBeVisible();
  });

  test("a seeded student can open the seeded room page", async ({ page }) => {
    await login(page, "taro_student");
    await page.goto(`/rooms/${ROOM_NUMBER}`);

    await expect(page.getByRole("heading", { name: "プログラミング入門クラス" })).toBeVisible();
    await expect(page.getByText(ROOM_NUMBER).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "進行中・募集中のマッチ" })).toBeVisible();
    await expect(page.getByText("Top 5 ランキング")).toBeVisible();
  });
});
