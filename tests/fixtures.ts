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
		portal: "admin",
		isGuest: false,
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
						portal: "user",
						isGuest: true,
						createdAt: now,
					},
				],
				recentNovels: [
					{ id: "n1", name: "The Lantern Archive", createdAt: now },
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
						portal: "admin",
						isGuest: false,
						roleId: "role-super",
						role: {
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
						portal: "user",
						isGuest: false,
						roleId: "role-reader",
						role: { id: "role-reader", slug: "reader", name: "Reader" },
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
				role: null,
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
			return json(route, { data: [], total: 0 });
		if (path === "/api/admin/configs/") return json(route, { data: [] });
		return json(route, { message: "Not mocked" }, 404);
	});

	return requests;
}
