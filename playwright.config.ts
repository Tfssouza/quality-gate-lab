import { defineConfig, devices } from "@playwright/test";

const apiURL = "http://127.0.0.1:3101";
const webURL = "http://127.0.0.1:3100";
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  timeout: 30_000,
  reporter: [
    ["list"],
    ["html", { open: "never" }],
    ["junit", { outputFile: "test-results/junit.xml" }],
  ],
  use: {
    baseURL: webURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "api", testMatch: "**/api/*.spec.ts", use: { baseURL: apiURL } },
    {
      name: "chromium",
      testMatch: "**/e2e/*.spec.ts",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      testMatch: "**/e2e/*.spec.ts",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      testMatch: "**/e2e/*.spec.ts",
      use: { ...devices["Desktop Safari"] },
    },
  ],
  webServer: [
    {
      command: "npm run start:api",
      url: `${apiURL}/health`,
      reuseExistingServer: false,
      timeout: 90_000,
      env: {
        PORT: "3101",
        TEST_MODE: "1",
        TEST_RESET_KEY: "isolated-test-fixtures",
        DATABASE_URL: process.env.TEST_DATABASE_URL || "",
      },
    },
    {
      command: "npm run start:web",
      url: webURL,
      reuseExistingServer: false,
      env: { WEB_PORT: "3100", VITE_API_TARGET: apiURL },
    },
  ],
});
