import { useCallback, useEffect, useState } from "react";

export type ThemePreference = "system" | "light" | "dark";
const THEME_KEY = "storylens-dashboard-theme";

function readPreference(): ThemePreference {
	try {
		const value = localStorage.getItem(THEME_KEY);
		return value === "light" || value === "dark" ? value : "system";
	} catch {
		return "system";
	}
}

export function applyTheme(preference: ThemePreference): void {
	const root = document.documentElement;
	if (preference === "system") root.removeAttribute("data-theme");
	else root.setAttribute("data-theme", preference);
}

/** Applies the saved theme before React renders, avoiding a flash. */
export function applySavedTheme(): void {
	applyTheme(readPreference());
}

export function useTheme() {
	const [preference, setPreference] = useState<ThemePreference>(readPreference);

	useEffect(() => {
		applyTheme(preference);
	}, [preference]);

	const choose = useCallback((next: ThemePreference) => {
		try {
			if (next === "system") localStorage.removeItem(THEME_KEY);
			else localStorage.setItem(THEME_KEY, next);
		} catch {
			// The choice still applies for this visit.
		}
		setPreference(next);
	}, []);

	return { preference, choose };
}
