import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { mockApi } from "./fixtures";

async function expectAccessible(page: Page) {
	const results = await new AxeBuilder({ page })
		.withTags(["wcag2a", "wcag2aa", "wcag21aa"])
		.analyze();
	expect(
		results.violations.map((violation) => `${violation.id}: ${violation.help}`),
	).toEqual([]);
}

/** Rewrites text like Google Translate: each text node becomes <font> wrappers. */
async function translatePage(scope: import("@playwright/test").Locator) {
	await scope.evaluate((root) => {
		const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
		const texts: Text[] = [];
		while (walker.nextNode()) texts.push(walker.currentNode as Text);
		for (const text of texts) {
			if (!text.nodeValue?.trim()) continue;
			const outer = document.createElement("font");
			const inner = document.createElement("font");
			inner.textContent = text.nodeValue;
			outer.append(inner);
			text.replaceWith(outer);
		}
	});
}

test("billing requests show the reader's contact and email, pending first", async ({
	page,
}) => {
	await mockApi(page, { signedIn: true });
	await page.goto("/billing-requests");
	await expect(
		page.getByRole("heading", { name: "Billing requests" }),
	).toBeVisible();
	await expect(page.getByRole("tab", { name: /Pending/ })).toHaveAttribute(
		"aria-selected",
		"true",
	);
	const mira = page.getByRole("row", { name: /Mira Vale/ });
	await expect(
		mira.getByRole("link", { name: /\+9647701234567/ }),
	).toHaveAttribute("href", /^https:\/\/wa\.me\/9647701234567\?text=/);
	await expect(
		mira.getByRole("link", { name: "mira@example.com" }),
	).toBeVisible();
	await expect(
		mira.getByText("At request: mira.old@example.com"),
	).toBeVisible();
	await expect(mira.getByText("$5.00")).toBeVisible();
	await expect(mira.getByText("Paid by Zain Cash, ref 42")).toBeVisible();
	const rowan = page.getByRole("row", { name: /Rowan/ });
	await expect(
		rowan.getByRole("link", { name: /@rowan_reads/ }),
	).toHaveAttribute("href", "https://t.me/rowan_reads");
	await expect(page.getByText("Payment not received")).toHaveCount(0);
	const nav = page.getByRole("navigation", { name: "Main" });
	if (await nav.isVisible()) {
		await expect(
			nav.getByRole("link", { name: /Billing requests/ }),
		).toContainText("2");
	}
	await expectAccessible(page);
});

test("approving asks first, then adds the lenses", async ({ page }) => {
	const requests = await mockApi(page, { signedIn: true });
	await page.goto("/billing-requests");
	await page
		.getByRole("row", { name: /Mira Vale/ })
		.getByRole("button", { name: "Approve" })
		.click();
	const dialog = page.getByRole("dialog", { name: "Approve this request?" });
	await expect(dialog).toContainText("500 lenses");
	await expect(dialog).toContainText("$5.00");
	await expect(dialog).toContainText("+9647701234567");
	await expect(dialog).toContainText(
		"Only approve after you have received the payment.",
	);
	await translatePage(dialog);
	await dialog.getByRole("button", { name: "Approve and add lenses" }).click();
	await expect(page.getByText(/Added 500 lenses/)).toBeVisible();
	expect(
		requests.filter(
			(request) =>
				request.method === "POST" &&
				request.path === "/api/admin/billing/requests/req-whatsapp/approve",
		),
	).toHaveLength(1);
	await expect(page.getByRole("row", { name: /Mira Vale/ })).toHaveCount(0);
});

test("an approval someone else already handled explains itself", async ({
	page,
}) => {
	await mockApi(page, { signedIn: true, approveConflict: true });
	await page.goto("/billing-requests");
	await page
		.getByRole("row", { name: /Rowan/ })
		.getByRole("button", { name: "Approve" })
		.click();
	const dialog = page.getByRole("dialog", { name: "Approve this request?" });
	await dialog.getByRole("button", { name: "Approve and add lenses" }).click();
	await expect(dialog.getByRole("alert")).toHaveText(
		"This request is already approved by Another Admin",
	);
});

test("rejecting needs a reason the reader will see", async ({ page }) => {
	const requests = await mockApi(page, { signedIn: true });
	await page.goto("/billing-requests");
	await page
		.getByRole("row", { name: /Rowan/ })
		.getByRole("button", { name: "Reject" })
		.click();
	const dialog = page.getByRole("dialog", { name: "Reject this request?" });
	await dialog.getByLabel("Reason").fill("no");
	await dialog.getByRole("button", { name: "Reject request" }).click();
	await expect(dialog.getByRole("alert")).toContainText(
		"at least 3 characters",
	);
	await dialog.getByLabel("Reason").fill("Payment did not arrive");
	await dialog.getByRole("button", { name: "Reject request" }).click();
	await expect(page.getByText("Request rejected")).toBeVisible();
	const reject = requests.find((request) =>
		request.path.endsWith("/req-telegram/reject"),
	);
	expect(reject?.body).toEqual({ reason: "Payment did not arrive" });

	await page.getByRole("tab", { name: /Rejected/ }).click();
	await expect(page).toHaveURL(/status=REJECTED/);
	await expect(page.getByText("Reason: Payment did not arrive")).toBeVisible();
});

test("search filters requests by contact", async ({ page }) => {
	await mockApi(page, { signedIn: true });
	await page.goto("/billing-requests");
	await page
		.getByLabel("Search by email, contact, name or username")
		.fill("rowan_reads");
	await expect(page).toHaveURL(/search=rowan_reads/);
	await expect(page.getByRole("row", { name: /Mira Vale/ })).toHaveCount(0);
	await expect(page.getByRole("row", { name: /Rowan/ })).toBeVisible();
});

test("roles without billing permissions see neither the pages nor the actions", async ({
	page,
}) => {
	await mockApi(page, {
		signedIn: true,
		permissions: ["GET /api/admin/users/"],
	});
	await page.goto("/billing-requests");
	await expect(
		page.getByRole("heading", { name: "You don’t have access to this page" }),
	).toBeVisible();
	await page.goto("/users");
	await expect(page.getByRole("button", { name: /Gift lenses/ })).toHaveCount(
		0,
	);
});

test("gifts show the reader what they will see and send a fresh ID", async ({
	page,
}) => {
	const requests = await mockApi(page, { signedIn: true });
	await page.goto("/users");
	await expect(page.getByRole("row", { name: /Mira Vale/ })).toContainText(
		"42",
	);
	await page.getByRole("button", { name: "Gift lenses to mira" }).click();
	const dialog = page.getByRole("dialog", { name: "Gift lenses to Mira Vale" });
	await dialog.getByLabel("Lenses").fill("25");
	await dialog.getByLabel("Note (optional)").fill("Welcome back");
	await expect(dialog).toContainText(
		"Story Lens sent you 25 lenses — Welcome back",
	);
	await dialog.getByRole("button", { name: "Gift lenses" }).click();
	await expect(page.getByText(/Gave Mira Vale 25 lenses/)).toBeVisible();
	const gift = requests.find((request) =>
		request.path.endsWith("/lenses/gifts"),
	);
	expect(gift?.body).toMatchObject({ lenses: 25, note: "Welcome back" });
	expect((gift?.body as { id: string }).id).toMatch(/^[0-9a-f-]{36}$/);
});

test("corrections cannot take a balance below zero", async ({ page }) => {
	const requests = await mockApi(page, { signedIn: true });
	await page.goto("/users");
	await page
		.getByRole("button", { name: "Correct mira's lens balance" })
		.click();
	const dialog = page.getByRole("dialog", {
		name: "Correct Mira Vale's balance",
	});
	await dialog.getByLabel("Change").fill("-50");
	await dialog.getByLabel("Reason").fill("Double approval");
	await dialog.getByRole("button", { name: "Save correction" }).click();
	await expect(dialog.getByRole("alert")).toContainText("can't go below zero");
	expect(
		requests.some((request) => request.path.endsWith("/adjustments")),
	).toBe(false);
	await dialog.getByLabel("Change").fill("-2");
	await dialog.getByRole("button", { name: "Save correction" }).click();
	await expect(page.getByText(/balance is now 40/)).toBeVisible();
});

test("lens history lists gifts and AI charges", async ({ page }) => {
	await mockApi(page, { signedIn: true });
	await page.goto("/users");
	await page.getByRole("button", { name: "Lens history of mira" }).click();
	const dialog = page.getByRole("dialog", {
		name: "Lens history of Mira Vale",
	});
	await expect(dialog).toContainText("Thanks for testing");
	await expect(dialog).toContainText("by Super Admin");
	await expect(dialog).toContainText("AI action · page_summary");
	await expectAccessible(page);
});

test("settings has a Configs tab and an AI tab; old addresses redirect", async ({
	page,
}) => {
	await mockApi(page, { signedIn: true });
	await page.goto("/configs");
	await expect(page).toHaveURL(/\/settings\?tab=configs$/);
	await expect(page.getByRole("tab", { name: "Configs" })).toHaveAttribute(
		"aria-selected",
		"true",
	);
	await expect(page.getByText("Lens_Price_USD")).toBeVisible();
	await page.getByRole("tab", { name: "AI" }).click();
	await expect(page).toHaveURL(/tab=ai/);
	await expect(page.getByRole("heading", { name: "Models" })).toBeVisible();
	await page.goto("/ai-pricing");
	await expect(page).toHaveURL(/\/settings\?tab=ai$/);
	const nav = page.getByRole("navigation", { name: "Main" });
	if (await nav.isVisible()) {
		await expect(nav.getByRole("link", { name: "Settings" })).toBeVisible();
		await expect(nav.getByRole("link", { name: "Configs" })).toHaveCount(0);
	}
});

test("the model pickers show prices and save the choice as a config", async ({
	page,
}) => {
	const requests = await mockApi(page, { signedIn: true });
	await page.goto("/settings?tab=ai");
	const models = page.getByRole("region", { name: "Models" });
	await expect(models.getByLabel("Text model", { exact: true })).toHaveValue(
		"google/gemini-2.5-flash",
	);
	await expect(models).toContainText("$0.30 / 1M tokens");
	await expect(models).toContainText("$2.50 / 1M tokens");
	await expect(models.getByLabel("Image model", { exact: true })).toHaveValue(
		"bytedance-seed/seedream-5-0-flash",
	);
	await expect(models).toContainText("$0.018");
	await expect(models).toContainText("4,175 image tokens");
	await expect(
		models.getByRole("row", { name: /Summarize page/ }),
	).toContainText("Covers the cost");

	await models.getByLabel("Search text models").fill("deepseek");
	await models
		.getByLabel("Text model", { exact: true })
		.selectOption("deepseek/deepseek-v4-flash");
	await expect(page.getByText("Text model saved")).toBeVisible();
	const saved = requests.find(
		(request) =>
			request.method === "PUT" &&
			(request.body as { key?: string } | null)?.key === "AI_Text_Model",
	);
	expect(saved?.body).toEqual({
		key: "AI_Text_Model",
		value: "deepseek/deepseek-v4-flash",
	});
	await expect(models).toContainText("$0.042 / 1M tokens");
	await expectAccessible(page);
});

test("a model that would lose money warns and asks before saving", async ({
	page,
}) => {
	const requests = await mockApi(page, { signedIn: true });
	await page.goto("/settings?tab=ai");
	const models = page.getByRole("region", { name: "Models" });
	await models
		.getByLabel("Text model", { exact: true })
		.selectOption("openai/gpt-5-pro");
	const dialog = page.getByRole("dialog", {
		name: "Use a model that loses money?",
	});
	await expect(dialog).toContainText("Summarize page");
	await expect(models.getByRole("alert")).toContainText(
		"Raise the lens price to at least",
	);
	await expect(
		models.getByRole("row", { name: /Summarize page/ }),
	).toContainText("Loses money");
	await dialog.getByRole("button", { name: "Cancel" }).click();
	expect(
		requests.some(
			(request) =>
				request.method === "PUT" && request.path === "/api/admin/configs/",
		),
	).toBe(false);
	await expect(models.getByLabel("Text model", { exact: true })).toHaveValue(
		"google/gemini-2.5-flash",
	);

	await models
		.getByLabel("Image model", { exact: true })
		.selectOption("google/gemini-3-pro-image");
	const imageDialog = page.getByRole("dialog", {
		name: "Use a model that loses money?",
	});
	await expect(imageDialog).toContainText("Character image");
	await imageDialog.getByRole("button", { name: "Use it anyway" }).click();
	await expect(page.getByText("Image model saved")).toBeVisible();
});

test("feature prices validate and save", async ({ page }) => {
	const requests = await mockApi(page, { signedIn: true });
	await page.goto("/settings?tab=ai");
	const summary = page.getByRole("form", { name: "Summarize page" });
	await expect(summary).toContainText("300 actions");
	await summary.getByLabel("Lenses per action").fill("-1");
	await summary.getByRole("button", { name: "Save" }).click();
	await expect(summary.getByRole("alert")).toContainText("0 to 10,000");
	await summary.getByLabel("Lenses per action").fill("3");
	await summary.getByRole("button", { name: "Save" }).click();
	await expect(page.getByText("Summarize page saved")).toBeVisible();
	const put = requests.find(
		(request) => request.path === "/api/admin/ai-pricing/page_summary",
	);
	expect(put?.body).toMatchObject({ lenses: 3, enabled: true });
	expect(put?.body).not.toHaveProperty("model");
});

test("configs show billing hints and the API's validation message", async ({
	page,
}) => {
	await mockApi(page, { signedIn: true });
	await page.goto("/settings?tab=configs");
	await page.getByRole("button", { name: "Edit Lens_Price_USD" }).click();
	const dialog = page.getByRole("dialog", { name: "Edit config" });
	await expect(dialog).toContainText("Price of one lens in US dollars");
	await dialog.getByLabel("Value").fill("abc");
	await dialog.getByRole("button", { name: "Save config" }).click();
	await expect(dialog.getByRole("alert")).toContainText(
		"Lens_Price_USD must be a dollar amount",
	);
});

test("the overview sums up lens sales and AI cost", async ({ page }) => {
	await mockApi(page, { signedIn: true });
	await page.goto("/");
	const section = page.getByRole("region", {
		name: "Lenses and cloud AI, last 30 days",
	});
	await expect(section).toContainText("Pending requests");
	await expect(section).toContainText("$26.00");
	await expect(section).toContainText("845");
	await expect(section).toContainText("$3.29");
});

test("billing pages fit a 375 px screen", async ({ page }) => {
	await page.setViewportSize({ width: 375, height: 800 });
	await mockApi(page, { signedIn: true });
	for (const path of ["/billing-requests", "/settings?tab=ai"]) {
		await page.goto(path);
		await expect(page.locator("h1")).toBeVisible();
		const overflow = await page.evaluate(
			() =>
				document.documentElement.scrollWidth -
				document.documentElement.clientWidth,
		);
		expect(overflow).toBeLessThanOrEqual(0);
	}
});
