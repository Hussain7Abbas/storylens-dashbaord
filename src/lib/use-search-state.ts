import { useCallback } from "react";
import { useSearchParams } from "react-router";

/**
 * List filters kept in the URL so views can be linked and survive reloads.
 * Changing any filter other than `page` returns to the first page.
 */
export function useSearchState<K extends string>(keys: readonly K[]) {
	const [params, setParams] = useSearchParams();

	const values = Object.fromEntries(
		keys.map((key) => [key, params.get(key) ?? ""]),
	) as Record<K, string>;
	const page = Math.max(1, Number(params.get("page")) || 1);

	const set = useCallback(
		(changes: Partial<Record<K | "page", string | number>>) => {
			setParams(
				(current) => {
					const next = new URLSearchParams(current);
					for (const [key, value] of Object.entries(changes)) {
						if (
							value === "" ||
							value === undefined ||
							(key === "page" && value === 1)
						)
							next.delete(key);
						else next.set(key, String(value));
					}
					if (!("page" in changes)) next.delete("page");
					return next;
				},
				{ replace: true },
			);
		},
		[setParams],
	);

	return { values, page, set };
}
