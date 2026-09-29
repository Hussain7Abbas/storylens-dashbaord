import { useQuery } from "@tanstack/react-query";
import {
	getGetKeywordsQueryKey,
	getKeywords,
} from "@/api/generated/endpoints/admin-keywords";
import type { GetKeywords200DataItem } from "@/api/generated/schemas";

const PAGE_SIZE = 100;

/** Under the generated keywords key, so invalidating keywords refreshes it too. */
export function novelKeywordsQueryKey(novelId: string) {
	return [...getGetKeywordsQueryKey(), "all", novelId] as const;
}

/** Every keyword of one novel, for searching and matching in the browser. */
export async function loadNovelKeywords(
	novelId: string,
	signal?: AbortSignal,
): Promise<GetKeywords200DataItem[]> {
	const first = await getKeywords(
		{ novelId, page: 1, pageSize: PAGE_SIZE },
		undefined,
		signal,
	);
	const pages = Math.ceil(first.total / PAGE_SIZE);
	const rest = await Promise.all(
		Array.from({ length: Math.max(pages - 1, 0) }, (_, index) =>
			getKeywords(
				{ novelId, page: index + 2, pageSize: PAGE_SIZE },
				undefined,
				signal,
			),
		),
	);
	return [first, ...rest].flatMap((page) => page.data);
}

export function novelKeywordsQuery(novelId: string) {
	return {
		queryKey: novelKeywordsQueryKey(novelId),
		queryFn: ({ signal }: { signal: AbortSignal }) =>
			loadNovelKeywords(novelId, signal),
		staleTime: 60_000,
	};
}

export function useNovelKeywords(novelId: string, enabled: boolean) {
	return useQuery({
		...novelKeywordsQuery(novelId),
		enabled: enabled && !!novelId,
	});
}
