// The dashboard session token lives in this browser's local storage and is
// sent as a bearer token; the API holds the session and its permissions.
const TOKEN_KEY = "storylens-dashboard-token";

type Listener = (token: string | null) => void;
const listeners = new Set<Listener>();

export function getToken(): string | null {
	try {
		return localStorage.getItem(TOKEN_KEY);
	} catch {
		return null;
	}
}

export function setToken(token: string | null): void {
	try {
		if (token) localStorage.setItem(TOKEN_KEY, token);
		else localStorage.removeItem(TOKEN_KEY);
	} catch {
		// Storage can be unavailable (private mode); the session then lasts until reload.
	}
	for (const listener of listeners) listener(token);
}

export function onTokenChange(listener: Listener): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}
