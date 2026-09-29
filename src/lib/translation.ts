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

export function otherLanguage(language: Language): Language {
	return language === "ar" ? "en" : "ar";
}

const ARABIC_LETTER =
	/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const LATIN_LETTER = /[A-Za-z\u00C0-\u024F]/;

/** The language a name is written in, from its script; null when it has no letters. */
export function scriptLanguage(text: string): Language | null {
	if (ARABIC_LETTER.test(text)) return "ar";
	if (LATIN_LETTER.test(text)) return "en";
	return null;
}

/**
 * A keyword's names by the language they are written in. Keywords from before
 * names were translated keep English names in `nameAr`, so a lone name goes by
 * its script; with both names the columns are trusted.
 */
export function namesByScript(item: Named): Record<Language, string | null> {
	const ar = item.nameAr || null;
	const en = item.nameEn || null;
	if (ar && en) return { ar, en };
	const name = ar ?? en;
	if (!name) return { ar: null, en: null };
	const language = scriptLanguage(name) ?? (ar ? "ar" : "en");
	return language === "ar" ? { ar: name, en: null } : { ar: null, en: name };
}

/** True when a lone name sits in the other language's column. */
export function isMisfiled(item: Named): boolean {
	return namesByScript(item).ar !== (item.nameAr || null);
}

/**
 * A keyword named in one language: its name, the language it is written in
 * (`source`) and the one it lacks (`target`). Null when it has both or neither.
 */
export function singleName(
	item: Named,
): { name: string; source: Language; target: Language } | null {
	if (!item.nameAr === !item.nameEn) return null;
	const names = namesByScript(item);
	const source: Language = names.ar ? "ar" : "en";
	return {
		name: names[source] ?? "",
		source,
		target: otherLanguage(source),
	};
}

type AliasNamed = {
	name: string;
	nameAr?: string | null;
	nameEn?: string | null;
};

/**
 * An alias's name in each language (mirrors the backend's `aliasNames`):
 * `nameAr`/`nameEn` when set, and `name` fills its script's language on older
 * aliases that have neither.
 */
export function aliasNames(alias: AliasNamed): Record<Language, string | null> {
	const names: Record<Language, string | null> = {
		ar: alias.nameAr || null,
		en: alias.nameEn || null,
	};
	const language = scriptLanguage(alias.name);
	if (
		language &&
		!names[language] &&
		!Object.values(names).includes(alias.name)
	)
		names[language] = alias.name;
	return names;
}
