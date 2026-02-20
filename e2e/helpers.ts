import { type Page, expect } from "@playwright/test";

export async function registerAndLogin(page: Page, suffix: string) {
  const email = `e2e-${suffix}-${Date.now()}@test.com`;
  const password = "password123";

  await page.goto("/register");
  await page.getByLabel("Name").fill(`E2E User ${suffix}`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /register|sign up|create account/i }).click();

  // Should redirect to dashboard
  await expect(page).toHaveURL("/", { timeout: 10_000 });

  return { email, password };
}
