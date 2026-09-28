import { defineConfig, devices } from "@playwright/test";

// Tests run against the production build with the API mocked per test.
// CHROMIUM_PATH points at a preinstalled Chromium when Playwright's own
// browser download is unavailable.
const launchOptions = process.env.CHROMIUM_PATH
	? { executablePath: process.env.CHROMIUM_PATH }
	: {};

export default defineConfig({
	testDir: "tests",
	fullyParallel: true,
	retries: process.env.CI ? 1 : 0,
	use: { baseURL: "http://localhost:4174", trace: "retain-on-failure" },
	webServer: {
		command: "bun run build && bun run preview",
		url: "http://localhost:4174/login",
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
	},
	projects: [
		{ name: "chromium", use: { ...devices["Desktop Chrome"], launchOptions } },
		{ name: "mobile", use: { ...devices["Pixel 7"], launchOptions } },
	],
});
