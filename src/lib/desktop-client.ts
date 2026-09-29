// The Story Lens desktop client runs AI prompts locally on 127.0.0.1. The
// dashboard pairs with it like the extension does (port + pairing token from
// the client's Settings tab); the client accepts this dashboard's origin.

const STORAGE_KEY = "storylens-dashboard-desktop-client";
const PROTOCOL_VERSION = 2;

export type DesktopSettings = {
	port: number;
	token: string;
	model: string;
	effort: string;
};

export type DesktopModel = {
	id: string;
	label: string;
	efforts: string[];
	defaultEffort: string;
};

export type DesktopCapabilities = {
	protocolVersion: number;
	models: DesktopModel[];
};

/** The desktop client's default port (`apps/client` `src/config.ts`). */
export const DEFAULT_PORT = 43127;

const DEFAULT_SETTINGS: DesktopSettings = {
	port: DEFAULT_PORT,
	token: "",
	model: "",
	effort: "",
};

export function loadDesktopSettings(): DesktopSettings {
	try {
		const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
		return stored && typeof stored === "object"
			? {
					...DEFAULT_SETTINGS,
					...stored,
					// Saved before the default existed, or with the field left empty.
					port: stored.port || DEFAULT_PORT,
				}
			: DEFAULT_SETTINGS;
	} catch {
		return DEFAULT_SETTINGS;
	}
}

export function saveDesktopSettings(settings: DesktopSettings): void {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function isPaired(settings: DesktopSettings): boolean {
	return (
		Number.isInteger(settings.port) &&
		settings.port >= 1024 &&
		settings.port <= 65535 &&
		!!settings.token
	);
}

export function isReady(settings: DesktopSettings): boolean {
	return isPaired(settings) && !!settings.model && !!settings.effort;
}

async function request(
	settings: DesktopSettings,
	path: string,
	init: RequestInit & { timeoutMs: number },
): Promise<unknown> {
	if (!isPaired(settings)) {
		throw new Error("Enter the desktop client’s port and pairing token.");
	}
	let response: Response;
	try {
		response = await fetch(`http://127.0.0.1:${settings.port}${path}`, {
			...init,
			headers: {
				Authorization: `Bearer ${settings.token}`,
				...init.headers,
			},
			cache: "no-store",
			signal: init.signal
				? AbortSignal.any([init.signal, AbortSignal.timeout(init.timeoutMs)])
				: AbortSignal.timeout(init.timeoutMs),
		});
	} catch (reason) {
		if (init.signal?.aborted) throw reason;
		throw new Error(
			"The desktop client is unreachable. Make sure it is running, the port is right, and your browser allowed this site to reach it.",
		);
	}
	const body: unknown = await response.json().catch(() => null);
	if (!response.ok) {
		const message =
			body &&
			typeof body === "object" &&
			"error" in body &&
			body.error &&
			typeof body.error === "object" &&
			"message" in body.error &&
			typeof body.error.message === "string"
				? body.error.message
				: `The desktop client returned HTTP ${response.status}.`;
		throw new Error(message);
	}
	return body;
}

export async function loadCapabilities(
	settings: DesktopSettings,
): Promise<DesktopCapabilities> {
	const data = await request(settings, "/capabilities", { timeoutMs: 20_000 });
	const capabilities = data as Partial<DesktopCapabilities> | null;
	if (
		capabilities?.protocolVersion !== PROTOCOL_VERSION ||
		!Array.isArray(capabilities.models)
	) {
		throw new Error(
			"The desktop client version doesn’t match this dashboard. Update the desktop client.",
		);
	}
	return capabilities as DesktopCapabilities;
}

/** Runs one prompt and returns the model's text answer. */
export async function executePrompt(
	settings: DesktopSettings,
	prompt: string,
	responseLanguage: "ar" | "en",
	signal?: AbortSignal,
): Promise<string> {
	const data = await request(settings, "/ExecutePrompt", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			prompt,
			model: settings.model,
			effort: settings.effort,
			responseLanguage,
		}),
		signal,
		timeoutMs: 320_000,
	});
	const output =
		data && typeof data === "object" && "output" in data ? data.output : null;
	if (typeof output !== "string") {
		throw new Error("The desktop client sent no answer.");
	}
	return output;
}
