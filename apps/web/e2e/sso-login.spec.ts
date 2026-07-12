import { expect, test } from "@playwright/test";

const KEYCLOAK_ISSUER = "http://localhost:8081/realms/ots";

let keycloakAvailable = false;

test.beforeAll(async ({ request }) => {
  try {
    const response = await request.get(
      `${KEYCLOAK_ISSUER}/.well-known/openid-configuration`,
    );
    keycloakAvailable = response.ok();
  } catch {
    keycloakAvailable = false;
  }
});

/**
 * OIDC PKCE login against the dev Keycloak realm (infra/keycloak/ots-realm.json).
 * Requires `docker compose up -d keycloak` on port 8081.
 */
test("SSO: consultant signs in via Keycloak and session shows in header", async ({
  page,
}) => {
  test.skip(!keycloakAvailable, "Keycloak not running on :8081");

  await page.goto("/engagements");
  await page.getByRole("button", { name: /consultant/i }).click();
  await page.getByRole("menuitem", { name: "Sign in with SSO" }).click();

  await expect(page).toHaveURL(/localhost:8081\/realms\/ots/);
  await page.locator("#username").fill("alex");
  await page.locator("#password").fill("alex");
  await page.getByRole("button", { name: /sign in/i }).click();

  await expect(page).toHaveURL(/\/auth\/callback/, { timeout: 15_000 });
  await expect(page).toHaveURL(/\/engagements/, { timeout: 30_000 });
  await expect(page.getByRole("button", { name: /Alex Morgan/i })).toBeVisible();
});

test("SSO: stakeholder signs in and role is stakeholder", async ({ page }) => {
  test.skip(!keycloakAvailable, "Keycloak not running on :8081");

  await page.goto("/engagements");
  await page.getByRole("button", { name: /consultant/i }).click();
  await page.getByRole("menuitem", { name: "Sign in with SSO" }).click();

  await expect(page).toHaveURL(/localhost:8081\/realms\/ots/);
  await page.locator("#username").fill("jordan");
  await page.locator("#password").fill("jordan");
  await page.getByRole("button", { name: /sign in/i }).click();

  await expect(page).toHaveURL(/\/auth\/callback/, { timeout: 15_000 });
  await expect(page).toHaveURL(/\/engagements/, { timeout: 30_000 });
  await expect(page.getByRole("button", { name: /Jordan Lee/i })).toBeVisible();
});
