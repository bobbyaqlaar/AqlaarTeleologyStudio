import { expect, type APIRequestContext, type Page } from "@playwright/test";

/** Shared Playwright flow matching docs/DemoScript.md (Scenes 2–11). */

export async function pickOption(
  page: Page,
  option: string | RegExp,
): Promise<void> {
  await page.getByRole("option", { name: option }).click();
}

export interface DemoFlowOptions {
  clientName?: string;
  engagementName?: string;
  includeExports?: boolean;
}

export async function runDemoRecordingFlow(
  page: Page,
  request: APIRequestContext,
  options: DemoFlowOptions = {},
): Promise<string | null> {
  const clientName = options.clientName ?? "Playwright Corp";
  const engagementName =
    options.engagementName ?? `E2E Telecom ${Date.now()}`;
  let engagementId: string | null = null;

  // Scene 2 — Create engagement
  await page.goto("/engagements");
  await page.getByRole("button", { name: "New engagement" }).click();
  await page.locator("#engagement-name").fill(engagementName);
  await page.locator("#engagement-client").fill(clientName);
  await page.locator("#engagement-industry").click();
  await pickOption(page, "Telecom (TM Forum eTOM)");
  await page.getByRole("button", { name: "Create and open streams" }).click();
  await expect(page).toHaveURL(/\/engagements\/eng-[a-f0-9]+\/streams$/);
  const match = page.url().match(/\/engagements\/(eng-[a-f0-9]+)\//);
  engagementId = match?.[1] ?? null;

  // Scene 3 — Load baselines
  const o2cCard = page
    .locator('[data-slot="card"]')
    .filter({ hasText: "O2C · Order to Cash" });
  await o2cCard.getByRole("button", { name: "Load baseline" }).click();
  await expect(o2cCard.getByText("Loaded", { exact: true })).toBeVisible();

  const p2pCard = page
    .locator('[data-slot="card"]')
    .filter({ hasText: "P2P · Procure to Pay" });
  await p2pCard.getByRole("button", { name: "Load baseline" }).click();
  await expect(p2pCard.getByText("Loaded", { exact: true })).toBeVisible();

  await o2cCard.getByRole("button", { name: "Edit process" }).click();
  await expect(page).toHaveURL(/\/streams\/o2c\/process$/);

  // Scene 4 — Process tagging
  await expect(page.locator(".djs-container")).toBeVisible();
  const taskButton = page
    .getByRole("button", { name: /Develop Sales Proposal/ })
    .first();
  await taskButton.click();
  await expect(page.getByText("Selected step")).toBeVisible();

  await page.locator("#function-unit").click();
  await pickOption(page, "Sales");
  await expect(taskButton.getByText("Sales", { exact: true })).toBeVisible();

  const systemsPanel = page
    .locator("div")
    .filter({ hasText: /^Systems/ })
    .filter({ has: page.getByText("Add system…") })
    .last();
  await page.getByText("Add system…").click();
  await pickOption(page, /^Salesforce/);
  await expect(systemsPanel.getByText("Salesforce")).toBeVisible();

  // Scene 5 — Ontology + thesaurus
  await page.getByRole("link", { name: "Ontology", exact: true }).click();
  await expect(page).toHaveURL(/\/ontology$/);
  await expect(page.getByText("Thesaurus", { exact: true })).toBeVisible();
  await page.getByPlaceholder("Search concepts…").fill("order");
  const mapButton = page.getByRole("button", { name: "Map" }).first();
  await expect(mapButton).toBeVisible();
  await mapButton.click();
  await expect(page.getByText(/Mapped .+ to thesaurus concept\./)).toBeVisible();

  // Scene 6 — Teleology
  await page.getByRole("link", { name: "Continue to teleology" }).click();
  await expect(page).toHaveURL(/\/teleology$/);
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

  // Scene 7 — Alignment + bridge gaps
  await page.getByRole("link", { name: "Alignment", exact: true }).click();
  await expect(page).toHaveURL(/\/alignment$/);
  await page.getByRole("button", { name: "Bridge gaps with AI" }).click();
  await expect(
    page.getByText(/AI drafted \d+ solution option\(s\)/),
  ).toBeVisible({ timeout: 120_000 });

  // Scene 8 — Initiatives
  await page.getByRole("link", { name: "Initiatives", exact: true }).click();
  await expect(page).toHaveURL(/\/initiatives$/);
  await page.getByRole("button", { name: "Draft initiatives with AI" }).click();
  await expect(
    page.getByText(/AI drafted \d+ initiative candidate\(s\)/),
  ).toBeVisible({ timeout: 120_000 });

  // Scene 9 — Workshop
  await page.getByRole("link", { name: "Workshop mode" }).click();
  await expect(page).toHaveURL(/\/workshop$/);
  await expect(page.getByText("Stakeholder workshop")).toBeVisible();
  await expect(page.getByText(/1 \/ \d+/)).toBeVisible();
  await page
    .locator("footer")
    .getByRole("button", { name: "Next", exact: true })
    .click();
  await expect(page.getByText(/2 \/ \d+/)).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Order to Cash" }),
  ).toBeVisible();
  await page
    .locator("footer")
    .getByRole("button", { name: "Next", exact: true })
    .click();
  await expect(page.getByText(/3 \/ \d+/)).toBeVisible();
  await page.getByRole("link", { name: "Exit" }).click();
  await expect(page).toHaveURL(
    new RegExp(`/engagements/${engagementId ?? "eng-"}[^/]*$`),
  );

  // Scene 10 — Stakeholder approval
  await page.getByRole("link", { name: "Review", exact: true }).click();
  await expect(page).toHaveURL(/\/review$/);
  await expect(
    page.locator('ol[aria-label="Engagement progress"] svg.lucide-check'),
  ).toHaveCount(4);

  const queueItem = page
    .locator("tr")
    .filter({ hasText: "O2C stream teleology" });
  await expect(queueItem).toBeVisible();

  await page.getByRole("button", { name: /consultant/i }).click();
  await page.getByRole("menuitemradio", { name: "Stakeholder" }).click();
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-base-ui-inert]")).toHaveCount(0);

  await queueItem.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText(/O2C stream teleology approved\./)).toBeVisible();
  await expect(queueItem.getByText("approved", { exact: true })).toBeVisible();

  // Scene 11 — Exports + audit (demo script only by default)
  if (options.includeExports !== false) {
    await page.getByRole("link", { name: "Overview", exact: true }).click();
    await expect(page).toHaveURL(
      new RegExp(`/engagements/${engagementId ?? "eng-"}[^/]*$`),
    );
    await page.getByRole("button", { name: "Download PDF" }).click();
    await expect(page.getByText("PDF downloaded.")).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole("link", { name: "View audit trail" }).click();
    await expect(page).toHaveURL(/\/audit$/);
    await expect(page.locator("table tbody tr").first()).toBeVisible();
  }

  if (engagementId) {
    await request.delete(
      `http://localhost:8000/api/v1/engagements/${engagementId}`,
    );
  }

  return engagementId;
}
