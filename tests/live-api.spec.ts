import { expect, test } from "@playwright/test";

const apiUrl = process.env.STORYLENS_E2E_API_URL;
const adminEmail = process.env.STORYLENS_E2E_ADMIN_EMAIL;
const adminPassword = process.env.STORYLENS_E2E_ADMIN_PASSWORD;

test.skip(
	!apiUrl || !adminEmail || !adminPassword,
	"Requires an isolated local backend, database, and seeded admin account.",
);

test("dashboard, reader API, and database work together", async ({
	page,
	request,
}) => {
	const url = new URL(apiUrl ?? "http://127.0.0.1");
	expect(["127.0.0.1", "localhost"]).toContain(url.hostname);
	const origin = url.origin;
	await page.route("**/api/**", async (route) => {
		if (new URL(route.request().url()).origin !== origin) {
			await route.abort("blockedbyclient");
			return;
		}
		await route.continue();
	});
	const suffix = Date.now().toString(36);
	const novelNameEn = `E2E Novel ${suffix}`;
	const novelNameAr = `رواية الاختبار ${suffix}`;
	const keywordNameAr = `شخصية ${suffix}`;
	const keywordNameEn = `Character ${suffix}`;
	const readerEmail = `e2e-${suffix}@example.test`;
	const readerPassword = `reader-${suffix}-password`;

	await page.goto("/login");
	await page.getByLabel("Email").fill(adminEmail ?? "");
	await page.getByLabel("Password").fill("wrong-password");
	await page.getByRole("button", { name: "Sign in" }).click();
	await expect(page.getByRole("alert")).toHaveText("Invalid email or password");
	await page.getByLabel("Password").fill(adminPassword ?? "");
	await page.getByRole("button", { name: "Sign in" }).click();
	await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
	const adminToken = await page.evaluate(() =>
		localStorage.getItem("storylens-dashboard-token"),
	);
	expect(adminToken).toBeTruthy();
	const adminHeaders = { Authorization: `Bearer ${adminToken}` };

	await page.goto("/users");
	await page.getByRole("button", { name: "New user" }).click();
	const userDialog = page.getByRole("dialog", { name: "New user" });
	await userDialog.getByLabel("Display name").fill("E2E Reader");
	await userDialog.getByLabel("Username").fill(`reader${suffix}`);
	await userDialog.getByLabel("Email").fill(readerEmail);
	await userDialog.getByLabel("Password").fill(readerPassword);
	await userDialog
		.getByRole("group", { name: "Reader access" })
		.getByRole("checkbox")
		.check();
	await userDialog.getByRole("button", { name: "Create user" }).click();
	await expect(
		page.getByRole("status").filter({ hasText: "User created" }),
	).toBeVisible();

	const readerLogin = await request.post(`${origin}/api/user/auth/login`, {
		data: { email: readerEmail, password: readerPassword },
	});
	expect(readerLogin.ok(), await readerLogin.text()).toBeTruthy();
	const reader = (await readerLogin.json()) as {
		token: string;
		user: { isAdmin: boolean; isUser: boolean };
	};
	expect(reader.user).toMatchObject({ isAdmin: true, isUser: true });
	const readerHeaders = { Authorization: `Bearer ${reader.token}` };
	const secondPortal = await request.post(`${origin}/api/admin/auth/login`, {
		data: { email: readerEmail, password: readerPassword },
	});
	expect(secondPortal.ok(), await secondPortal.text()).toBeTruthy();

	await page.goto("/novels");
	await page.getByRole("button", { name: "New novel" }).click();
	const novelDialog = page.getByRole("dialog", { name: "New novel" });
	await novelDialog.getByLabel("Arabic name").fill(novelNameAr);
	await novelDialog.getByLabel("English name").fill(novelNameEn);
	await novelDialog.getByLabel("AI context").fill("An isolated test story.");
	await novelDialog.getByRole("button", { name: "Create novel" }).click();
	await expect(
		page.getByRole("status").filter({ hasText: "Novel created" }),
	).toBeVisible();

	const novelList = await request.get(
		`${origin}/api/admin/novels/?search=${encodeURIComponent(novelNameEn)}`,
		{
			headers: adminHeaders,
		},
	);
	expect(novelList.ok(), await novelList.text()).toBeTruthy();
	const novels = (await novelList.json()) as {
		data: {
			id: string;
			nameAr: string | null;
			nameEn: string | null;
			context: string | null;
		}[];
	};
	const novel = novels.data.find((item) => item.nameEn === novelNameEn);
	expect(novel).toMatchObject({
		nameAr: novelNameAr,
		context: "An isolated test story.",
	});
	if (!novel) throw new Error("Created novel is missing from the API");

	const [categoriesResponse, naturesResponse] = await Promise.all([
		request.get(`${origin}/api/user/keyword-categories/`, {
			headers: readerHeaders,
		}),
		request.get(`${origin}/api/user/keyword-natures/`, {
			headers: readerHeaders,
		}),
	]);
	expect(categoriesResponse.ok(), await categoriesResponse.text()).toBeTruthy();
	expect(naturesResponse.ok(), await naturesResponse.text()).toBeTruthy();
	const categories = (await categoriesResponse.json()) as {
		data: { id: string }[];
	};
	const natures = (await naturesResponse.json()) as { data: { id: string }[] };
	expect(categories.data.length).toBeGreaterThan(0);
	expect(natures.data.length).toBeGreaterThan(0);
	const createdKeyword = await request.post(`${origin}/api/user/keywords/`, {
		headers: { ...readerHeaders, "Accept-Language": "ar" },
		data: {
			nameAr: keywordNameAr,
			novelId: novel.id,
			categoryId: categories.data[0]?.id,
			natureId: natures.data[0]?.id,
		},
	});
	expect(createdKeyword.ok(), await createdKeyword.text()).toBeTruthy();
	const keyword = (await createdKeyword.json()) as { id: string };

	await page.goto(`/translations?novel=${novel.id}`);
	const translation = page.getByRole("textbox", {
		name: `English name for ${keywordNameAr}`,
	});
	await expect(translation).toBeVisible();
	await translation.fill(keywordNameEn);
	await page
		.getByRole("row")
		.filter({ has: translation })
		.getByRole("button", { name: "Save" })
		.click();
	await expect(page.getByText("Row saved")).toBeVisible();

	const translated = await request.get(
		`${origin}/api/admin/keywords/?novelId=${novel.id}`,
		{
			headers: adminHeaders,
		},
	);
	expect(translated.ok(), await translated.text()).toBeTruthy();
	const keywords = (await translated.json()) as {
		data: { id: string; nameEn: string | null }[];
	};
	expect(keywords.data.find((item) => item.id === keyword.id)?.nameEn).toBe(
		keywordNameEn,
	);

	const outdated = await request.get(`${origin}/api/user/novels/`, {
		headers: { ...readerHeaders, "X-Client-Version": "extension/0.9.0" },
	});
	expect(outdated.status()).toBe(426);
	expect(outdated.headers()["x-min-client-version"]).toBeTruthy();
});
