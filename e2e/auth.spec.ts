import { test, expect } from "@playwright/test";
import { registerAndLogin } from "./helpers";

test.describe("Authentication", () => {
  test("register and land on dashboard", async ({ page }) => {
    await registerAndLogin(page, "register");
    // Dashboard should be visible
    await expect(page.getByText("Dashboard")).toBeVisible();
  });

  test("login with existing credentials", async ({ page }) => {
    // First register
    const { email, password } = await registerAndLogin(page, "login");

    // Logout
    await page.getByText("Sign out").click();
    await expect(page).toHaveURL("/login", { timeout: 10_000 });

    // Login again
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL("/", { timeout: 10_000 });
  });
});
