import { useQuery } from "@tanstack/react-query";
import {
	getGetNovelsByIdKeywordsQueryKey,
	getNovelsByIdKeywords,
} from "@/api/generated/endpoints/admin-novels";

/**
 * Every keyword of one novel with its aliases and versions, for searching and
 * matching in the browser. Shares the novel profile's query, so
 * `refreshKeywords` updates both.
 */
export function novelKeywordsQuery(novelId: string) {
	return {
		queryKey: getGetNovelsByIdKeywordsQueryKey(novelId),
		// The full response, as the generated `useGetNovelsByIdKeywords` caches it.
		queryFn: ({ signal }: { signal: AbortSignal }) =>
			getNovelsByIdKeywords(novelId, undefined, signal),
		staleTime: 60_000,
	};
}

export function useNovelKeywords(novelId: string, enabled: boolean) {
	return useQuery({
		...novelKeywordsQuery(novelId),
		select: (response) => response.data,
		enabled: enabled && !!novelId,
	});
}
