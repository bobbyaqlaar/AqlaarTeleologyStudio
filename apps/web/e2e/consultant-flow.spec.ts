import { test } from "@playwright/test";
import { runDemoRecordingFlow } from "./lib/demo-recording-flow";

/**
 * Full consultant workflow against the real stack (Postgres + Fuseki + API).
 * Mirrors the core path in docs/DemoScript.md without PDF/audit teardown extras.
 */
test("consultant flow: create → load O2C → tag → thesaurus map → teleology → review approve", async ({
  page,
  request,
}) => {
  await runDemoRecordingFlow(page, request, { includeExports: false });
});
