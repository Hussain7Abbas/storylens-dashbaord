import { LANGUAGE_LABELS, type Language } from "@/lib/translation";

export type TranslationSource = {
	id: string;
	/** The keyword's only name, in the other language than `target`. */
	name: string;
	description: string | null;
	aliases: string[];
};

/** A keyword already named only in the target language, which a source may be. */
export type TranslationCandidate = { id: string; name: string };

export type TranslationSuggestion = {
	translation: string;
	/** Candidate the AI thinks is the same character, place or thing. */
	matchId: string | null;
};

const MAX_DESCRIPTION = 300;
const MAX_CANDIDATES = 400;

/**
 * Asks for each source keyword's name in `target`, and whether it already
 * exists among the target-language-only candidates. One prompt per target
 * language, because the desktop client answers in one language.
 */
export function buildTranslationPrompt(input: {
	novelName: string;
	target: Language;
	sources: TranslationSource[];
	candidates: TranslationCandidate[];
}): string {
	const targetLabel = LANGUAGE_LABELS[input.target];
	const sourceLabel = LANGUAGE_LABELS[input.target === "ar" ? "en" : "ar"];
	const sources = input.sources.map((source) => ({
		id: source.id,
		name: source.name,
		...(source.aliases.length ? { aliases: source.aliases } : {}),
		...(source.description
			? { description: source.description.slice(0, MAX_DESCRIPTION) }
			: {}),
	}));
	const candidates = input.candidates
		.slice(0, MAX_CANDIDATES)
		.map(({ id, name }) => ({ id, name }));

	return [
		`You translate glossary entries (characters, places, techniques, items) of the web novel "${input.novelName}" from ${sourceLabel} to ${targetLabel}.`,
		"",
		"For every entry in SOURCES:",
		`- translation: the name as ${targetLabel} readers of this novel know it. Prefer the established name from official or popular fan translations; otherwise transliterate it the way ${targetLabel} translators of this genre do. Give the name only, with no explanation or quotes.`,
		`- matchId: the id of the CANDIDATES entry that is the same character, place or thing (the ${targetLabel} name of this entry already exists), or null. Only match when you are confident; a similar-looking name is not enough.`,
		"",
		`SOURCES (${sourceLabel}):`,
		JSON.stringify(sources),
		"",
		`CANDIDATES (${targetLabel}, not yet linked to a ${sourceLabel} name):`,
		JSON.stringify(candidates),
		"",
		'Answer with only a JSON array, one object per source, in this exact shape: [{"id":"…","translation":"…","matchId":null}]',
	].join("\n");
}

/** Reads the model's JSON answer, keeping only known ids and candidate matches. */
export function parseTranslationAnswer(
	output: string,
	sourceIds: Set<string>,
	candidateIds: Set<string>,
): Map<string, TranslationSuggestion> {
	const start = output.indexOf("[");
	const end = output.lastIndexOf("]");
	if (start < 0 || end <= start) {
		throw new Error("The AI answer contained no translations.");
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(output.slice(start, end + 1));
	} catch {
		throw new Error("The AI answer was not valid JSON.");
	}
	if (!Array.isArray(parsed)) {
		throw new Error("The AI answer was not a list.");
	}

	const suggestions = new Map<string, TranslationSuggestion>();
	for (const entry of parsed) {
		if (!entry || typeof entry !== "object") continue;
		const { id, translation, matchId } = entry as Record<string, unknown>;
		if (typeof id !== "string" || !sourceIds.has(id)) continue;
		suggestions.set(id, {
			translation: typeof translation === "string" ? translation.trim() : "",
			matchId:
				typeof matchId === "string" && candidateIds.has(matchId)
					? matchId
					: null,
		});
	}
	return suggestions;
}
