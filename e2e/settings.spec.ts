import { test, expect } from "@playwright/test";
import { registerAndLogin } from "./helpers";

test.describe("Settings", () => {
  test("change password, logout, login with new password", async ({ page }) => {
    const { email } = await registerAndLogin(page, "settings");

    // Navigate to settings
    await page.getByText("Settings").click();
    await expect(page).toHaveURL("/settings");

    // Change password — labels match "Current Password" and "New Password" in the UI
    const newPassword = "newpassword456";
    await page.getByLabel("Current Password").fill("password123");
    await page.getByLabel("New Password").fill(newPassword);
    await page.getByLabel("Confirm New Password").fill(newPassword);
    await page.getByRole("button", { name: /change password/i }).click();

    // Wait for success message — settings page shows "Password updated"
    await expect(page.getByText(/password updated/i)).toBeVisible({ timeout: 5_000 });

    // Logout
    await page.getByText("Sign out").click();
    await expect(page).toHaveURL("/login", { timeout: 10_000 });

    // Login with new password
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(newPassword);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL("/", { timeout: 10_000 });
  });
});
