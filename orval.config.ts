import { defineConfig } from "orval";

// Generates the dashboard client from a running backend's OpenAPI spec (the
// spec is disabled in production, so point this at a local API). Only the
// dashboard API (`Admin: …` tags, `/api/admin`) is generated; the
// `ApiAdmin` prefix is dropped from Elysia's operation IDs
// (`getApiAdminUsersById` -> `getUsersById`).
const apiUrl = process.env.ORVAL_API_URL ?? "http://localhost:3030";

const operationName = (operation: { operationId?: string }): string =>
	(operation.operationId ?? "")
		.replace(/^(get|post|put|patch|delete)ApiAdmin/, "$1")
		.replace(/-([a-z0-9])/gi, (_, letter: string) => letter.toUpperCase());

export default defineConfig({
	"storylens-admin-api": {
		input: {
			target: `${apiUrl}/openapi.json`,
			filters: { mode: "include", tags: [/^Admin: /] },
		},
		output: {
			mode: "tags",
			target: "./src/api/generated/endpoints",
			schemas: "./src/api/generated/schemas",
			client: "react-query",
			httpClient: "axios",
			biome: true,
			clean: true,
			override: {
				operationName,
				mutator: {
					path: "./src/api/axios-instance.ts",
					name: "customInstance",
				},
			},
		},
	},
});
