import { test } from "@playwright/test";
import { runDemoRecordingFlow } from "./lib/demo-recording-flow";

/**
 * Validates docs/DemoScript.md (Scenes 2–11) against the live stack.
 * Run: npm run test:e2e -- e2e/demo-script.spec.ts
 */
test("demo recording script: full consultant discovery → roadmap → approval → exports", async ({
  page,
  request,
}) => {
  await runDemoRecordingFlow(page, request, {
    clientName: "Globex Telecom",
    engagementName: `Demo Globex ${Date.now()}`,
    includeExports: true,
  });
});
