import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "password123!";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByPlaceholder("username または email@example.com").fill("taro_student");
  await page.getByPlaceholder("パスワード").fill(PASSWORD);
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test.describe("practice solo smoke", () => {
  test("student can run a solo battle and see replay result", async ({ page }) => {
    await login(page);

    await page.goto("/practice");
    await expect(page.getByRole("heading", { name: "ソロバトル" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "リプレイ" })).toBeVisible();

    await page.getByRole("button", { name: "対戦開始" }).click();

    await expect(page.getByLabel("現在ターン")).toHaveText(/TURN [1-9]/, { timeout: 10_000 });
    await expect(page.getByText(/残HP: あなた/)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: "再挑戦" })).toBeVisible();
  });
});
