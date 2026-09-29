import type { Page, Route } from "@playwright/test";

// Minimal mocked dashboard API. Paths match `/api/admin/...` on any origin.
export const ALL_PERMISSIONS = [
	"GET /api/admin/stats/",
	"GET /api/admin/users/",
	"GET /api/admin/users/:id",
	"POST /api/admin/users/",
	"PUT /api/admin/users/:id",
	"DELETE /api/admin/users/:id",
	"DELETE /api/admin/users/:id/sessions",
	"GET /api/admin/roles/",
	"GET /api/admin/roles/:id",
	"POST /api/admin/roles/",
	"PUT /api/admin/roles/:id",
	"DELETE /api/admin/roles/:id",
	"GET /api/admin/permissions/",
	"GET /api/admin/novels/",
	"POST /api/admin/novels/",
	"PUT /api/admin/novels/:id",
	"DELETE /api/admin/novels/:id",
	"POST /api/admin/files/upload",
	"GET /api/admin/keywords/",
	"PUT /api/admin/keywords/:id",
	"POST /api/admin/keywords/:id/link",
	"POST /api/admin/keywords/:id/alias",
	"POST /api/admin/keywords/:id/version",
	"GET /api/admin/configs/",
	"PUT /api/admin/configs/",
	"DELETE /api/admin/configs/:key",
	"PUT /api/admin/auth/me",
	"PUT /api/admin/auth/password",
];

const now = "2026-09-28T12:00:00.000Z";

export function adminUser(permissions = ALL_PERMISSIONS) {
	return {
		id: "admin-id",
		email: "admin@storylens.local",
		username: "admin",
		name: "Super Admin",
		isGuest: false,
		isUser: false,
		isAdmin: true,
		portal: "admin",
		role: { id: "role-super", slug: "super-admin", name: "Super Admin" },
		permissions,
	};
}

export const roles = [
	{
		id: "role-super",
		slug: "super-admin",
		name: "Super Admin",
		description: "Full dashboard access.",
		portal: "admin",
		isSystem: true,
		createdAt: now,
		updatedAt: now,
		userCount: 1,
		permissionIds: ["p-admin-1"],
	},
	{
		id: "role-reader",
		slug: "reader",
		name: "Reader",
		description: "Registered reader.",
		portal: "user",
		isSystem: true,
		createdAt: now,
		updatedAt: now,
		userCount: 3,
		permissionIds: ["p-user-1"],
	},
];

export const permissions = {
	admin: [
		{
			id: "p-admin-1",
			key: "GET /api/admin/users/",
			portal: "admin",
			group: "users",
			method: "GET",
			path: "/api/admin/users/",
			description: "List users",
		},
	],
	user: [
		{
			id: "p-user-1",
			key: "GET /api/user/novels/",
			portal: "user",
			group: "novels",
			method: "GET",
			path: "/api/user/novels/",
			description: "List novels",
		},
		{
			id: "p-user-2",
			key: "POST /api/user/novels/",
			portal: "user",
			group: "novels",
			method: "POST",
			path: "/api/user/novels/",
			description: "Add a novel",
		},
		{
			id: "p-user-3",
			key: "user:moderate",
			portal: "user",
			group: "moderation",
			method: null,
			path: null,
			description: "Moderate shared data",
		},
	],
};

const json = (route: Route, body: unknown, status = 200) =>
	route.fulfill({
		status,
		contentType: "application/json",
		body: JSON.stringify(body),
	});

const NOVEL_ID = "11111111-1111-4111-8111-111111111111";
export const KEYWORD_IDS = {
	mira: "22222222-2222-4222-8222-222222222222",
	lanternAr: "33333333-3333-4333-8333-333333333333",
	lanternEn: "44444444-4444-4444-8444-444444444444",
};

export const novels = [
	{
		id: NOVEL_ID,
		nameAr: "أرشيف الفانوس",
		nameEn: "The Lantern Archive",
		descriptionAr: null,
		descriptionEn: null,
		context: null,
		slugs: ["lantern-archive"],
		imageId: null,
		image: null,
		createdById: null,
		createdBy: null,
		createdAt: now,
		updatedAt: now,
		counts: { chapters: 0, keywords: 3, replacements: 0 },
	},
];

export const keywords = [
	{
		id: KEYWORD_IDS.mira,
		novelId: NOVEL_ID,
		nameAr: "ميرا",
		nameEn: null,
		description: "حارسة الأرشيف",
		aliases: [],
	},
	{
		id: KEYWORD_IDS.lanternAr,
		novelId: NOVEL_ID,
		nameAr: "الفانوس",
		nameEn: null,
		description: null,
		aliases: [],
	},
	{
		id: KEYWORD_IDS.lanternEn,
		novelId: NOVEL_ID,
		nameAr: null,
		nameEn: "The Lantern",
		description: "A glowing relic",
		aliases: [],
	},
];

/** Mocks the paired desktop client on 127.0.0.1 with a fixed AI answer. */
export async function mockDesktopClient(page: Page) {
	const prompts: string[] = [];
	await page.addInitScript(() =>
		localStorage.setItem(
			"storylens-dashboard-desktop-client",
			JSON.stringify({ port: 47000, token: "pair", model: "m", effort: "low" }),
		),
	);
	await page.route("http://127.0.0.1:47000/**", async (route) => {
		const body = route.request().postDataJSON() as {
			prompt: string;
			responseLanguage: string;
		};
		prompts.push(body.prompt);
		const answer =
			body.responseLanguage === "en"
				? [
						{ id: KEYWORD_IDS.mira, translation: "Mira", matchId: null },
						{
							id: KEYWORD_IDS.lanternAr,
							translation: "Lantern",
							matchId: KEYWORD_IDS.lanternEn,
						},
					]
				: [
						{
							id: KEYWORD_IDS.lanternEn,
							translation: "الفانوس",
							matchId: null,
						},
					];
		return json(route, { output: JSON.stringify(answer) });
	});
	return prompts;
}

/** Mocks the dashboard API; `signedIn` seeds a stored session token. */
export async function mockApi(
	page: Page,
	options: { signedIn?: boolean; permissions?: string[] } = {},
) {
	const user = adminUser(options.permissions);
	const requests: { method: string; path: string; body: unknown }[] = [];

	if (options.signedIn) {
		await page.addInitScript(() =>
			localStorage.setItem("storylens-dashboard-token", "test-token"),
		);
	}

	await page.route("**/api/admin/**", async (route) => {
		const request = route.request();
		const url = new URL(request.url());
		const path = url.pathname;
		const method = request.method();
		requests.push({ method, path, body: request.postDataJSON?.() ?? null });

		if (path === "/api/admin/auth/login") {
			const body = request.postDataJSON() as { password?: string };
			return body.password === "correct-password"
				? json(route, { user, token: "test-token" })
				: json(route, { message: "Invalid email or password" }, 401);
		}
		if (path === "/api/admin/auth/me") return json(route, user);
		if (path === "/api/admin/auth/logout")
			return json(route, { success: true });
		if (path === "/api/admin/stats/") {
			return json(route, {
				users: { readers: 1280, guests: 342, dashboard: 2, newThisWeek: 57 },
				content: { novels: 14, keywords: 2310, replacements: 188 },
				roles: 4,
				configs: 1,
				recentUsers: [
					{
						id: "u1",
						username: "QuietOwl",
						email: "q@guest.storylens.local",
						isUser: true,
						isAdmin: false,
						isGuest: true,
						createdAt: now,
					},
				],
				recentNovels: [
					{
						id: "n1",
						nameAr: null,
						nameEn: "The Lantern Archive",
						createdAt: now,
					},
				],
			});
		}
		if (path === "/api/admin/users/" && method === "GET") {
			return json(route, {
				data: [
					{
						id: "admin-id",
						email: user.email,
						emailVerified: true,
						username: "admin",
						name: "Super Admin",
						image: null,
						isGuest: false,
						isUser: false,
						userRoleId: null,
						userRole: null,
						isAdmin: true,
						adminRoleId: "role-super",
						adminRole: {
							id: "role-super",
							slug: "super-admin",
							name: "Super Admin",
						},
						createdAt: now,
						updatedAt: now,
					},
					{
						id: "reader-id",
						email: "mira@example.com",
						emailVerified: true,
						username: "mira",
						name: "Mira Vale",
						image: null,
						isGuest: false,
						isUser: true,
						userRoleId: "role-reader",
						userRole: { id: "role-reader", slug: "reader", name: "Reader" },
						isAdmin: false,
						adminRoleId: null,
						adminRole: null,
						createdAt: now,
						updatedAt: now,
					},
				],
				total: 2,
			});
		}
		if (path === "/api/admin/users/" && method === "POST") {
			const body = request.postDataJSON() as Record<string, string>;
			return json(route, {
				...body,
				id: "new-id",
				emailVerified: true,
				image: null,
				isGuest: false,
				userRole: null,
				adminRole: null,
				createdAt: now,
				updatedAt: now,
			});
		}
		if (path === "/api/admin/roles/") return json(route, { data: roles });
		if (path.startsWith("/api/admin/roles/") && method === "GET") {
			const role = roles.find((item) => path.endsWith(item.id));
			return role
				? json(route, role)
				: json(route, { message: "Role not found" }, 404);
		}
		if (path.startsWith("/api/admin/roles/") && method === "PUT") {
			const role = roles.find((item) => path.endsWith(item.id));
			return json(route, { ...role, ...(request.postDataJSON() as object) });
		}
		if (path === "/api/admin/permissions/") {
			const portal =
				url.searchParams.get("portal") === "user" ? "user" : "admin";
			return json(route, { data: permissions[portal] });
		}
		if (path === "/api/admin/novels/")
			return json(route, { data: novels, total: novels.length });
		if (path === "/api/admin/keywords/") {
			// Untranslated rows, or link candidates named only in English.
			const data =
				url.searchParams.get("has") === "en"
					? keywords.filter((keyword) => keyword.nameEn && !keyword.nameAr)
					: keywords;
			return json(route, { data, total: data.length });
		}
		if (path.startsWith("/api/admin/keywords/") && method !== "GET") {
			const keyword = keywords.find((item) => path.includes(item.id));
			return json(route, { ...keyword, ...(request.postDataJSON() as object) });
		}
		if (path === "/api/admin/configs/") return json(route, { data: [] });
		return json(route, { message: "Not mocked" }, 404);
	});

	return requests;
}
