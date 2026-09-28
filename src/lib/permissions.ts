// Permission keys of the dashboard API (`METHOD /api/admin/...`), as the
// backend syncs them from its routes. The API enforces them; the dashboard
// uses them only to hide pages and actions a role cannot use.
export const PERMISSIONS = {
	overview: "GET /api/admin/stats/",
	users: {
		list: "GET /api/admin/users/",
		view: "GET /api/admin/users/:id",
		create: "POST /api/admin/users/",
		update: "PUT /api/admin/users/:id",
		delete: "DELETE /api/admin/users/:id",
		signOut: "DELETE /api/admin/users/:id/sessions",
	},
	roles: {
		list: "GET /api/admin/roles/",
		view: "GET /api/admin/roles/:id",
		create: "POST /api/admin/roles/",
		update: "PUT /api/admin/roles/:id",
		delete: "DELETE /api/admin/roles/:id",
		permissions: "GET /api/admin/permissions/",
	},
	novels: {
		list: "GET /api/admin/novels/",
		view: "GET /api/admin/novels/:id",
		create: "POST /api/admin/novels/",
		update: "PUT /api/admin/novels/:id",
		delete: "DELETE /api/admin/novels/:id",
		upload: "POST /api/admin/files/upload",
	},
	configs: {
		list: "GET /api/admin/configs/",
		save: "PUT /api/admin/configs/",
		delete: "DELETE /api/admin/configs/:key",
	},
	account: {
		update: "PUT /api/admin/auth/me",
		password: "PUT /api/admin/auth/password",
	},
} as const;

/** Role slug that always holds every admin permission. */
export const SUPER_ADMIN_ROLE = "super-admin";
