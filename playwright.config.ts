import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
    headless: true,
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "E2E=1 NEXT_PUBLIC_E2E=1 npm run dev",
        port: 3000,
        timeout: 120_000,
        reuseExistingServer: true,
      },
});
