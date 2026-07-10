import { expect, test, type Page } from "@playwright/test";

/**
 * Full consultant workflow against the real stack (Postgres + Fuseki + API):
 * create engagement (telecom) → load O2C baseline → tag a task with a
 * function unit + system → map an ontology class to a thesaurus concept →
 * capture a teleology goal and submit → switch to stakeholder and approve.
 *
 * Base UI selects/dialogs ignore synthetic .click() — Playwright dispatches
 * trusted events, but option lists render in portals, so always await the
 * option role after opening a trigger.
 */

async function pickOption(page: Page, option: string | RegExp): Promise<void> {
  await page.getByRole("option", { name: option }).click();
}

test("consultant flow: create → load O2C → tag → thesaurus map → teleology → review approve", async ({
  page,
}) => {
  const name = `E2E Telecom ${Date.now()}`;

  // 1. Create a telecom engagement
  await page.goto("/engagements");
  await page.getByRole("button", { name: "New engagement" }).click();
  await page.locator("#engagement-name").fill(name);
  await page.locator("#engagement-client").fill("Playwright Corp");
  await page.locator("#engagement-industry").click();
  await pickOption(page, "Telecom (TM Forum eTOM)");
  await page.getByRole("button", { name: "Create and open streams" }).click();
  await expect(page).toHaveURL(/\/engagements\/eng-[a-f0-9]+\/streams$/);
  const engagementId = /\/engagements\/(eng-[a-f0-9]+)\//.exec(page.url())![1];

  // 2. Load the O2C baseline
  const o2cCard = page
    .locator('[data-slot="card"]')
    .filter({ hasText: "O2C · Order to Cash" });
  await o2cCard.getByRole("button", { name: "Load baseline" }).click();
  await expect(o2cCard.getByText("Loaded", { exact: true })).toBeVisible();
  await o2cCard.getByRole("button", { name: "Edit process" }).click();
  await expect(page).toHaveURL(/\/streams\/o2c\/process$/);

  // 3. Tag a task with a function unit + system
  await expect(page.locator(".djs-container")).toBeVisible(); // BPMN editor ready
  const taskButton = page
    .getByRole("button", { name: /Develop Sales Proposal/ })
    .first();
  await taskButton.click();
  await expect(page.getByText("Selected step")).toBeVisible();

  await page.locator("#function-unit").click();
  await pickOption(page, "Sales");
  await expect(
    taskButton.getByText("Sales", { exact: true }),
  ).toBeVisible(); // tag reflected in the task list

  const systemsPanel = page
    .locator("div")
    .filter({ hasText: /^Systems/ })
    .filter({ has: page.getByText("Add system…") })
    .last();
  await page.getByText("Add system…").click();
  await pickOption(page, /^Salesforce/);
  await expect(systemsPanel.getByText("Salesforce")).toBeVisible();

  // 4. Map an ontology class to a thesaurus concept
  await page.getByRole("link", { name: "Ontology", exact: true }).click();
  await expect(page).toHaveURL(/\/ontology$/);
  await expect(page.getByText("Thesaurus")).toBeVisible();
  await page.getByPlaceholder("Search concepts…").fill("order");
  const mapButton = page.getByRole("button", { name: "Map" }).first();
  await expect(mapButton).toBeVisible();
  await mapButton.click();
  await expect(page.getByText(/Mapped .+ to thesaurus concept\./)).toBeVisible();

  // 5. Capture teleology and submit for review
  await page.goto(`/engagements/${engagementId}/teleology`);
  await expect(page.getByText("Stream teleology")).toBeVisible();
  await page.getByPlaceholder("Add goal…").fill("Cut order cycle time by 30%");
  await page.getByPlaceholder("Add goal…").press("Enter");
  await expect(page.getByText("Cut order cycle time by 30%")).toBeVisible();
  await page.getByRole("button", { name: "Save row" }).click();
  await expect(page.getByText("Teleology row saved.")).toBeVisible();
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(
    page.getByText("Submitted for stakeholder review."),
  ).toBeVisible();

  // 6. Approve as stakeholder (role is client state — switch after navigating)
  await page.goto(`/engagements/${engagementId}/review`);
  const queueItem = page
    .locator("tr")
    .filter({ hasText: "O2C stream teleology" });
  await expect(queueItem).toBeVisible();

  await page.getByRole("button", { name: /consultant/i }).click();
  await page.getByRole("menuitemradio", { name: "Stakeholder" }).click();
  // The menu's portal overlay intercepts pointer events until fully closed.
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-base-ui-inert]")).toHaveCount(0);

  await queueItem.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText(/O2C stream teleology approved\./)).toBeVisible();
  await expect(queueItem.getByText("approved", { exact: true })).toBeVisible();
});
