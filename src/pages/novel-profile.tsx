import { ArrowLeft, BookOpen } from "lucide-react";
import { Link, useParams } from "react-router";
import {
	useGetKeywordCategories,
	useGetKeywordNatures,
} from "@/api/generated/endpoints/admin-keywords";
import {
	useGetNovelsById,
	useGetNovelsByIdKeywords,
} from "@/api/generated/endpoints/admin-novels";
import { CharactersSection } from "@/components/keywords/characters-section";
import { ErrorState, TableSkeleton } from "@/components/ui/page";
import { useAuth } from "@/lib/auth";
import { formatDate, formatNumber } from "@/lib/format";
import { PERMISSIONS } from "@/lib/permissions";
import { bothNames } from "@/lib/translation";

function Detail({ label, children }: { label: string; children: string }) {
	return (
		<div>
			<dt className="text-xs font-semibold tracking-wide text-muted uppercase">
				{label}
			</dt>
			<dd className="mt-0.5 text-sm" dir="auto">
				{children}
			</dd>
		</div>
	);
}

/** One novel: its details, then every character (keyword) with versions and aliases. */
export function NovelProfilePage() {
	const { id = "" } = useParams();
	const { can } = useAuth();
	const novel = useGetNovelsById(id);
	const keywords = useGetNovelsByIdKeywords(id, {
		query: { enabled: can(PERMISSIONS.novels.keywords) },
	});
	const categories = useGetKeywordCategories({
		query: { enabled: can(PERMISSIONS.keywords.categories) },
	});
	const natures = useGetKeywordNatures({
		query: { enabled: can(PERMISSIONS.keywords.natures) },
	});

	const back = (
		<Link
			to="/novels"
			className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-accent"
		>
			<ArrowLeft size={16} strokeWidth={1.75} aria-hidden />
			<span>Novels</span>
		</Link>
	);

	if (novel.error)
		return (
			<>
				{back}
				<div className="card">
					<ErrorState
						error={novel.error}
						onRetry={() => void novel.refetch()}
					/>
				</div>
			</>
		);
	if (!novel.data)
		return (
			<>
				{back}
				<div className="card">
					<TableSkeleton rows={3} />
				</div>
			</>
		);

	const data = novel.data;
	return (
		<>
			{back}
			<div className="grid grid-cols-1 gap-6">
				<section className="card flex flex-col gap-5 p-5 sm:flex-row">
					<div className="grid aspect-[3/4] w-32 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-wash text-muted">
						{data.image ? (
							<img
								src={data.image.url}
								alt=""
								className="size-full object-cover"
							/>
						) : (
							<BookOpen size={28} strokeWidth={1.75} aria-hidden />
						)}
					</div>
					<div className="min-w-0 flex-1">
						<h1 className="text-2xl font-semibold tracking-tight capitalize">
							{bothNames(data)}
						</h1>
						<p className="mt-1 flex flex-wrap gap-2 text-sm text-muted">
							<span className="badge">
								{formatNumber(data.counts.keywords)} keywords
							</span>
							<span className="badge">
								{formatNumber(data.counts.chapters)} chapters
							</span>
							<span className="badge">
								{formatNumber(data.counts.replacements)} replacements
							</span>
							{!data.context && (
								<span className="badge badge-warning">No AI context</span>
							)}
						</p>
						<dl className="mt-4 grid gap-4 sm:grid-cols-2">
							{data.descriptionAr && (
								<Detail label="Arabic description">{data.descriptionAr}</Detail>
							)}
							{data.descriptionEn && (
								<Detail label="English description">
									{data.descriptionEn}
								</Detail>
							)}
							<Detail label="Slugs">
								{data.slugs.length ? data.slugs.join(", ") : "None"}
							</Detail>
							<Detail label="Added">
								{`${formatDate(data.createdAt)}${data.createdBy ? ` by ${data.createdBy.username}` : ""}`}
							</Detail>
						</dl>
						{data.context && (
							<details className="mt-4 text-sm">
								<summary className="font-semibold">AI context</summary>
								<p className="mt-2 whitespace-pre-line text-muted" dir="auto">
									{data.context}
								</p>
							</details>
						)}
					</div>
				</section>

				{!can(PERMISSIONS.novels.keywords) ? null : keywords.error ? (
					<div className="card">
						<ErrorState
							error={keywords.error}
							onRetry={() => void keywords.refetch()}
						/>
					</div>
				) : !keywords.data ? (
					<div className="card">
						<TableSkeleton columns={8} />
					</div>
				) : (
					<CharactersSection
						novelId={id}
						keywords={keywords.data.data}
						options={{
							categories: categories.data?.data ?? [],
							natures: natures.data?.data ?? [],
						}}
					/>
				)}
			</div>
		</>
	);
}
