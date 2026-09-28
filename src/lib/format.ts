const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium" });
const dateTimeFormat = new Intl.DateTimeFormat("en", {
	dateStyle: "medium",
	timeStyle: "short",
});
const numberFormat = new Intl.NumberFormat("en");

/** API dates arrive as ISO strings; the generated types leave them loose. */
function toDate(value: unknown): Date | null {
	if (value instanceof Date) return value;
	if (typeof value !== "string" && typeof value !== "number") return null;
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value: unknown): string {
	const date = toDate(value);
	return date ? dateFormat.format(date) : "—";
}

export function formatDateTime(value: unknown): string {
	const date = toDate(value);
	return date ? dateTimeFormat.format(date) : "—";
}

export function formatNumber(value: number): string {
	return numberFormat.format(value);
}

export function initials(name: string): string {
	const parts = name.trim().split(/\s+/).filter(Boolean);
	const letters =
		parts.length > 1
			? `${parts[0]?.[0]}${parts.at(-1)?.[0]}`
			: name.slice(0, 2);
	return letters.toUpperCase();
}
