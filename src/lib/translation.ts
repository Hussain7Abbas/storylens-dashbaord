/** Languages novel and keyword names are stored in (`nameAr`/`nameEn`). */
export type Language = "ar" | "en";

export const LANGUAGE_LABELS: Record<Language, string> = {
	ar: "Arabic",
	en: "English",
};

type Named = { nameAr?: string | null; nameEn?: string | null };

export function nameIn(item: Named, language: Language): string | null {
	return (language === "ar" ? item.nameAr : item.nameEn) ?? null;
}

/** Both names for dashboard lists and dialogs, which manage every language. */
export function bothNames(item: Named): string {
	return (
		[item.nameEn, item.nameAr].filter((name) => name?.trim()).join(" · ") ||
		"Untitled"
	);
}

/** The language a single-language keyword is missing, or null when it has both or neither. */
export function missingLanguage(item: Named): Language | null {
	if (item.nameAr && !item.nameEn) return "en";
	if (item.nameEn && !item.nameAr) return "ar";
	return null;
}
