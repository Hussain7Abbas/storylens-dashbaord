import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { KEYWORD_IDS, mockApi, mockDesktopClient, novels } from "./fixtures";

async function expectAccessible(page: import("@playwright/test").Page) {
	const results = await new AxeBuilder({ page })
		.withTags(["wcag2a", "wcag2aa", "wcag21aa"])
		.analyze();
	expect(
		results.violations.map((violation) => `${violation.id}: ${violation.help}`),
	).toEqual([]);
}

test("signed-out visitors land on sign-in, which offers no registration", async ({
	page,
}) => {
	await mockApi(page);
	await page.goto("/users");
	await expect(page).toHaveURL(/\/login$/);
	await expect(
		page.getByRole("heading", { name: "Story Lens Dashboard" }),
	).toBeVisible();
	await expect(page.getByLabel("Email")).toHaveAttribute(
		"autocomplete",
		"username",
	);
	await expect(page.getByLabel("Password")).toHaveAttribute(
		"autocomplete",
		"current-password",
	);
	await expect(
		page.getByRole("link", { name: /register|sign up|create account/i }),
	).toHaveCount(0);
	await expectAccessible(page);
});

test("a wrong password shows the API error and a correct one signs in", async ({
	page,
}) => {
	await mockApi(page);
	await page.goto("/login");
	await page.getByLabel("Email").fill("admin@storylens.local");
	await page.getByLabel("Password").fill("wrong");
	await page.getByRole("button", { name: "Sign in" }).click();
	await expect(page.getByRole("alert")).toHaveText("Invalid email or password");

	await page.getByLabel("Password").fill("correct-password");
	await page.getByRole("button", { name: "Sign in" }).click();
	await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
	await expect(page.getByText("1,280")).toBeVisible();
	expect(
		await page.evaluate(() =>
			localStorage.getItem("storylens-dashboard-token"),
		),
	).toBe("test-token");
});

for (const theme of ["light", "dark"] as const) {
	test(`overview and users are accessible in ${theme} mode`, async ({
		page,
	}) => {
		await page.emulateMedia({ colorScheme: theme });
		await mockApi(page, { signedIn: true });
		await page.goto("/");
		await expect(page.getByText("The Lantern Archive")).toBeVisible();
		await expectAccessible(page);
		await page.goto("/users");
		await expect(page.getByText("Mira Vale")).toBeVisible();
		await expectAccessible(page);
	});
}

test("one new user can get both reader and dashboard access", async ({
	page,
}) => {
	const requests = await mockApi(page, { signedIn: true });
	await page.goto("/users");
	await page.getByRole("button", { name: "New user" }).click();
	const dialog = page.getByRole("dialog", { name: "New user" });
	await dialog.getByLabel("Display name").fill("Rowan Reed");
	await dialog.getByLabel("Username").fill("rowan");
	await dialog.getByLabel("Email").fill("rowan@example.com");
	await dialog.getByLabel("Password").fill("a-strong-password");
	const dashboard = dialog.getByRole("group", { name: "Dashboard access" });
	await expect(dashboard.getByLabel("Role")).toHaveValue("role-super");
	const reader = dialog.getByRole("group", { name: "Reader access" });
	await reader.getByRole("checkbox").check();
	await expect(reader.getByLabel("Role")).toHaveValue("role-reader");
	await dialog.getByRole("button", { name: "Create user" }).click();
	await expect(
		page.getByRole("status").filter({ hasText: "User created" }),
	).toBeVisible();
	const created = requests.find(
		(request) =>
			request.method === "POST" && request.path === "/api/admin/users/",
	);
	expect(created?.body).toMatchObject({
		isUser: true,
		userRoleId: "role-reader",
		isAdmin: true,
		adminRoleId: "role-super",
		username: "rowan",
	});
});

test("the list shows each account's access and roles", async ({ page }) => {
	await mockApi(page, { signedIn: true });
	await page.goto("/users");
	await expect(page.getByText("Dashboard · Super Admin")).toBeVisible();
	await expect(page.getByText("Reader · Reader")).toBeVisible();
});

test("pages and actions follow the role's permissions", async ({ page }) => {
	await mockApi(page, {
		signedIn: true,
		permissions: ["GET /api/admin/users/"],
	});
	await page.goto("/");
	// Without the overview permission, home redirects to the first allowed page.
	await expect(page).toHaveURL(/\/users$/);
	await expect(page.getByRole("button", { name: "New user" })).toHaveCount(0);
	await expect(page.getByRole("button", { name: /Delete/ })).toHaveCount(0);
	const nav = page.getByRole("navigation", { name: "Main" });
	if (await nav.isVisible()) {
		await expect(nav.getByRole("link")).toHaveText(["Users"]);
	}
	await page.goto("/configs");
	await expect(
		page.getByRole("heading", { name: "You don’t have access to this page" }),
	).toBeVisible();
});

test("the role editor saves the selected reader permissions", async ({
	page,
}) => {
	const requests = await mockApi(page, { signedIn: true });
	await page.goto("/roles/role-reader");
	await expect(page.getByRole("heading", { name: "Reader" })).toBeVisible();
	await page.getByRole("checkbox", { name: "Novels", exact: true }).check();
	await expect(page.getByText("2 of 3 selected")).toBeVisible();
	await page.getByRole("button", { name: "Save role" }).click();
	await expect(page).toHaveURL(/\/roles$/);
	const saved = requests.find((request) => request.method === "PUT");
	expect(saved?.body).toMatchObject({
		permissionIds: ["p-user-1", "p-user-2"],
	});
});

test("match translations suggests names and saves a row, a link and a bulk selection", async ({
	page,
}) => {
	const requests = await mockApi(page, { signedIn: true });
	const prompts = await mockDesktopClient(page);
	await page.goto(`/translations?novel=${novels[0]?.id}`);

	const mira = page.getByRole("textbox", { name: "English name for ميرا" });
	await expect(mira).toHaveValue("Mira");
	// The AI matched "الفانوس" to the English-only "The Lantern", so it prefills Link.
	const lanternRow = page
		.getByRole("row")
		.filter({ has: page.getByRole("checkbox", { name: "Select الفانوس" }) });
	await expect(lanternRow.getByText("The Lantern")).toBeVisible();
	await expect(
		page.getByRole("textbox", { name: "English name for الفانوس" }),
	).toBeDisabled();
	await expect(
		page.getByRole("combobox", { name: "Make الفانوس an alias of" }),
	).toBeDisabled();
	expect(prompts).toHaveLength(2);

	await page
		.getByRole("row")
		.filter({ has: mira })
		.getByRole("button", { name: "Save" })
		.click();
	await expect(page.getByText("Row saved")).toBeVisible();
	expect(requests).toContainEqual({
		method: "PUT",
		path: `/api/admin/keywords/${KEYWORD_IDS.mira}`,
		body: { nameEn: "Mira" },
	});

	await page.getByRole("checkbox", { name: "Select الفانوس" }).check();
	await page.getByRole("checkbox", { name: "Select The Lantern" }).check();
	await page.getByRole("button", { name: "Save selected (2)" }).click();
	await expect(page.getByText("2 rows saved")).toBeVisible();
	expect(requests).toContainEqual({
		method: "POST",
		path: `/api/admin/keywords/${KEYWORD_IDS.lanternAr}/link`,
		body: { targetId: KEYWORD_IDS.lanternEn },
	});
	expect(requests).toContainEqual({
		method: "PUT",
		path: `/api/admin/keywords/${KEYWORD_IDS.lanternEn}`,
		body: { nameAr: "الفانوس" },
	});

	const results = await new AxeBuilder({ page }).analyze();
	expect(results.violations).toEqual([]);
});
