/**
 * Folds case, Latin accents, Arabic diacritics and tatweel, and Arabic
 * spelling variants (أ إ آ ٱ → ا, ة → ه, ى → ي, ؤ → و, ئ → ي), so near-identical
 * names compare equal. NFKD splits hamza forms into a letter and a mark.
 */
export function normalizeForSearch(text: string): string {
	return text
		.normalize("NFKD")
		.toLowerCase()
		.replace(/[̀-ͯؐ-ًؚ-ٰٟۖ-ۭـ]/g, "")
		.replace(/ٱ/g, "ا")
		.replace(/ة/g, "ه")
		.replace(/ى/g, "ي")
		.replace(/[^\p{L}\p{N}]+/gu, " ")
		.trim();
}

/** Edit distance counting a swap of neighbouring letters as one edit. */
function editDistance(a: string, b: string): number {
	const width = b.length + 1;
	const table = new Uint16Array((a.length + 1) * width);
	const at = (i: number, j: number) => table[i * width + j] ?? 0;
	for (let i = 0; i <= a.length; i++) table[i * width] = i;
	for (let j = 0; j <= b.length; j++) table[j] = j;
	for (let i = 1; i <= a.length; i++) {
		for (let j = 1; j <= b.length; j++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			let best = Math.min(
				at(i - 1, j) + 1,
				at(i, j - 1) + 1,
				at(i - 1, j - 1) + cost,
			);
			if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
				best = Math.min(best, at(i - 2, j - 2) + 1);
			table[i * width + j] = best;
		}
	}
	return at(a.length, b.length);
}

/** True when every letter of `query` appears in `text` in order, close together. */
function isCloseSubsequence(query: string, text: string): boolean {
	let start = -1;
	let at = -1;
	for (const letter of query) {
		at = text.indexOf(letter, at + 1);
		if (at < 0) return false;
		if (start < 0) start = at;
	}
	return at - start < query.length * 3;
}

/**
 * How well a normalized `text` matches a normalized `query`: 0 for no match,
 * higher for better ones (exact, prefix, word prefix, substring, then typos
 * and skipped letters).
 */
export function fuzzyScore(query: string, text: string): number {
	if (!query) return 1;
	if (!text) return 0;
	if (text === query) return 100;
	if (text.startsWith(query)) return 90;
	const words = text.split(" ");
	if (words.some((word) => word.startsWith(query))) return 80;
	if (text.includes(query)) return 70;
	const compactQuery = query.replaceAll(" ", "");
	const compactText = text.replaceAll(" ", "");
	if (compactText.includes(compactQuery)) return 65;
	if (compactQuery.length >= 3) {
		const allowed = compactQuery.length >= 6 ? 2 : 1;
		let distance = Number.POSITIVE_INFINITY;
		for (const candidate of [compactText, ...words]) {
			distance = Math.min(
				distance,
				editDistance(compactQuery, candidate),
				editDistance(compactQuery, candidate.slice(0, compactQuery.length)),
			);
		}
		if (distance <= allowed) return 55 - distance * 10;
	}
	if (compactQuery.length >= 2 && isCloseSubsequence(compactQuery, compactText))
		return 20;
	return 0;
}
