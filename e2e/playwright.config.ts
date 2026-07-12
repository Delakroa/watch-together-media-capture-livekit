import { defineConfig, devices } from "@playwright/test";

// The E2E suite runs against the full local stack (backend + Redis + LiveKit + gateway).
// Bring it up first with `pnpm infra:up`; the gateway serves the frontend on 8088.
const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:8088";

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  // Multi-user tests manage several browser contexts and share one room, so keep them
  // serial and single-worker to avoid cross-test interference.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          // Let LiveKit establish WebRTC without real devices or a user gesture.
          args: [
            "--use-fake-device-for-media-stream",
            "--use-fake-ui-for-media-stream",
            "--autoplay-policy=no-user-gesture-required",
          ],
        },
      },
    },
  ],
});
