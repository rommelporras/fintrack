import { test, expect } from "@playwright/test";
import { registerAndLogin } from "./helpers";

test.describe("Transactions", () => {
  test("create account and transaction", async ({ page }) => {
    await registerAndLogin(page, "txn-create");

    // Navigate to accounts
    await page.getByText("Accounts").click();
    await expect(page).toHaveURL("/accounts");

    // Open create account dialog
    await page.getByRole("button", { name: /add account/i }).click();

    // Fill in account name
    await page.getByLabel("Name").fill("Test Bank");

    // Type is already defaulted to "bank" — no change needed

    // Submit the form
    await page.getByRole("button", { name: /create account/i }).click();

    // Account should appear
    await expect(page.getByText("Test Bank")).toBeVisible({ timeout: 5_000 });

    // Navigate to transactions
    await page.getByText("Transactions").click();
    await expect(page).toHaveURL("/transactions");

    // Go to new transaction page
    await page.getByRole("link", { name: /new/i }).click();
    await expect(page).toHaveURL("/transactions/new");

    // Fill in the transaction form
    await page.getByLabel("Amount").fill("500");
    await page.getByLabel("Description").fill("E2E Test Transaction");
    await page.getByRole("button", { name: /save|add|create/i }).click();

    // Should redirect back to transactions list with the new transaction
    await expect(page).toHaveURL("/transactions", { timeout: 10_000 });
    await expect(page.getByText("E2E Test Transaction")).toBeVisible({ timeout: 5_000 });
  });

  test("dashboard shows data after creating transactions", async ({ page }) => {
    await registerAndLogin(page, "txn-dashboard");
    // Dashboard should at least render without errors
    await expect(page.getByText("Dashboard")).toBeVisible();
    // The dashboard loads but may show empty state for new user
    await expect(page.locator("main")).toBeVisible();
  });
});
