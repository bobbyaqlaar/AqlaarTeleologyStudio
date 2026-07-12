import { defineConfig, devices } from "@playwright/test";

/**
 * E2E for the consultant flow against the real stack.
 *
 * Prerequisites: `docker compose up -d postgres fuseki` from the repo root
 * (the API webServer below needs both). The web app and API are started
 * automatically (and reused when already running).
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 180_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "npm run dev -- -p 3100",
      url: "http://localhost:3100",
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command:
        'cd ../.. && uv run --with fastapi --with "uvicorn[standard]" --with sqlmodel ' +
        '--with "psycopg[binary]" --with anthropic --with python-dotenv ' +
        '--with httpx --with alembic --with reportlab --with "pyjwt[crypto]" ' +
        'python -m uvicorn main:app --app-dir services/api --port 8000',
      cwd: ".",
      env: {
        OTS_DATABASE_URL: "postgresql+psycopg://ots:ots@localhost:5434/ots",
        FUSEKI_URL: "http://localhost:3030",
        FUSEKI_DATASET: "ots",
        FUSEKI_USER: "admin",
        FUSEKI_PASSWORD: "admin",
        OTS_BASELINE_DIR: "data/baselines",
        OTS_THESAURUS_DIR: "data/thesaurus",
      },
      url: "http://localhost:8000/api/v1/engagements",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
