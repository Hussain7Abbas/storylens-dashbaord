import { useQueryClient } from "@tanstack/react-query";
import { BookOpen, ImagePlus, Pencil, Plus, Trash2, X } from "lucide-react";
import { type FormEvent, type KeyboardEvent, useState } from "react";
import { axiosInstance, errorMessage } from "@/api/axios-instance";
import {
	getGetNovelsQueryKey,
	useDeleteNovelsById,
	useGetNovels,
	usePostNovels,
	usePutNovelsById,
} from "@/api/generated/endpoints/admin-novels";
import type {
	GetNovels200DataItem,
	PostFilesUpload200,
} from "@/api/generated/schemas";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import {
	EmptyState,
	ErrorState,
	PageHeader,
	TableSkeleton,
} from "@/components/ui/page";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth";
import { formatDate, formatNumber } from "@/lib/format";
import { PERMISSIONS } from "@/lib/permissions";
import { useSearchState } from "@/lib/use-search-state";

type Novel = GetNovels200DataItem;
const PAGE_SIZE = 20;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

async function uploadImage(file: File): Promise<PostFilesUpload200> {
	const body = new FormData();
	body.append("file", file);
	const { data } = await axiosInstance.post<PostFilesUpload200>(
		"/api/admin/files/upload",
		body,
	);
	return data;
}

function SlugInput({
	slugs,
	onChange,
}: {
	slugs: string[];
	onChange: (slugs: string[]) => void;
}) {
	const [text, setText] = useState("");
	const add = () => {
		const slug = text.trim();
		if (slug && !slugs.includes(slug)) onChange([...slugs, slug]);
		setText("");
	};
	const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key === "Enter" || event.key === ",") {
			event.preventDefault();
			add();
		}
	};
	return (
		<div>
			<div className="flex gap-2">
				<input
					className="input"
					value={text}
					placeholder="e.g. desolate-era"
					onChange={(event) => setText(event.target.value)}
					onKeyDown={onKeyDown}
					aria-label="Add slug"
				/>
				<Button onClick={add} disabled={!text.trim()}>
					Add
				</Button>
			</div>
			{slugs.length > 0 && (
				<ul className="mt-2 flex flex-wrap gap-2" aria-label="Slugs">
					{slugs.map((slug) => (
						<li key={slug} className="badge badge-accent py-1 pr-1">
							{slug}
							<button
								type="button"
								className="grid size-5 place-items-center rounded-full hover:bg-surface"
								aria-label={`Remove ${slug}`}
								onClick={() => onChange(slugs.filter((item) => item !== slug))}
							>
								<X size={12} strokeWidth={1.75} aria-hidden />
							</button>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

function NovelForm({
	novel,
	onDone,
}: {
	novel: Novel | null;
	onDone: () => void;
}) {
	const { can } = useAuth();
	const queryClient = useQueryClient();
	const toast = useToast();
	const [values, setValues] = useState({
		name: novel?.name ?? "",
		description: novel?.description ?? "",
		context: novel?.context ?? "",
	});
	const [slugs, setSlugs] = useState<string[]>(novel?.slugs ?? []);
	const [image, setImage] = useState<{ id: string; url: string } | null>(
		novel?.image ? { id: novel.image.id, url: novel.image.url } : null,
	);
	const [uploading, setUploading] = useState(false);
	const [error, setError] = useState("");

	const onSuccess = async () => {
		await queryClient.invalidateQueries({ queryKey: getGetNovelsQueryKey() });
		toast.success(novel ? "Novel updated" : "Novel created");
		onDone();
	};
	const onError = (reason: unknown) => setError(errorMessage(reason));
	const create = usePostNovels({ mutation: { onSuccess, onError } });
	const update = usePutNovelsById({ mutation: { onSuccess, onError } });

	const pickImage = async (file: File | undefined) => {
		if (!file) return;
		if (!file.type.startsWith("image/"))
			return setError("Choose an image file.");
		if (file.size > MAX_IMAGE_BYTES)
			return setError("Images must be 8 MB or smaller.");
		setError("");
		setUploading(true);
		try {
			const uploaded = await uploadImage(file);
			setImage({ id: uploaded.id, url: uploaded.url });
		} catch (reason) {
			setError(errorMessage(reason, "The image could not be uploaded."));
		} finally {
			setUploading(false);
		}
	};

	const submit = (event: FormEvent) => {
		event.preventDefault();
		setError("");
		const data = {
			name: values.name.trim(),
			description: values.description.trim() || null,
			context: values.context.trim() || null,
			imageId: image?.id ?? null,
			slugs,
		};
		if (novel) update.mutate({ id: novel.id, data });
		else create.mutate({ data });
	};

	const busy = create.isPending || update.isPending;

	return (
		<form onSubmit={submit} className="grid gap-4">
			<div className="flex items-start gap-4">
				<div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-wash">
					{image ? (
						<img
							src={image.url}
							alt="Cover"
							className="size-full object-cover"
						/>
					) : (
						<ImagePlus
							size={22}
							strokeWidth={1.75}
							className="text-muted"
							aria-hidden
						/>
					)}
				</div>
				<div className="space-y-2 text-sm">
					<p className="font-semibold">Cover image</p>
					{can(PERMISSIONS.novels.upload) ? (
						<div className="flex flex-wrap gap-2">
							<label
								className={`btn btn-secondary ${uploading ? "pointer-events-none opacity-60" : ""}`}
							>
								{uploading ? "Uploading…" : image ? "Replace" : "Upload"}
								<input
									type="file"
									accept="image/*"
									className="sr-only"
									disabled={uploading}
									onChange={(event) => void pickImage(event.target.files?.[0])}
								/>
							</label>
							{image && (
								<Button variant="ghost" onClick={() => setImage(null)}>
									Remove
								</Button>
							)}
						</div>
					) : (
						<p className="text-muted">Your role can’t upload images.</p>
					)}
				</div>
			</div>
			<Field label="Name" hint="Unique; readers see it in the extension.">
				<input
					className="input"
					required
					maxLength={300}
					value={values.name}
					onChange={(event) =>
						setValues({ ...values, name: event.target.value })
					}
				/>
			</Field>
			<Field
				label="Slugs"
				hint="URL slugs the extension uses to detect this novel on reading sites."
			>
				<SlugInput slugs={slugs} onChange={setSlugs} />
			</Field>
			<Field label="Description">
				<textarea
					className="input"
					rows={3}
					maxLength={5000}
					value={values.description}
					onChange={(event) =>
						setValues({ ...values, description: event.target.value })
					}
				/>
			</Field>
			<Field
				label="AI context"
				hint="Setting, premise, tone and main cast that AI prompts use for this novel."
			>
				<textarea
					className="input"
					rows={6}
					maxLength={20000}
					value={values.context}
					onChange={(event) =>
						setValues({ ...values, context: event.target.value })
					}
				/>
			</Field>
			{error && (
				<p className="field-error" role="alert">
					{error}
				</p>
			)}
			<div className="flex justify-end gap-2">
				<Button onClick={onDone} disabled={busy}>
					Cancel
				</Button>
				<Button
					type="submit"
					variant="primary"
					loading={busy}
					disabled={uploading}
				>
					{novel ? "Save changes" : "Create novel"}
				</Button>
			</div>
		</form>
	);
}

export function NovelsPage() {
	const { can } = useAuth();
	const toast = useToast();
	const queryClient = useQueryClient();
	const { values, page, set } = useSearchState(["search", "sort"] as const);
	const [editing, setEditing] = useState<Novel | "new" | null>(null);
	const [deleting, setDeleting] = useState<Novel | null>(null);
	const [deleteError, setDeleteError] = useState("");

	const novels = useGetNovels(
		{
			page,
			pageSize: PAGE_SIZE,
			search: values.search || undefined,
			sort: values.sort === "name" ? "name" : "newest",
		},
		{ query: { placeholderData: (previous) => previous } },
	);

	const closeDelete = () => {
		setDeleting(null);
		setDeleteError("");
	};
	const remove = useDeleteNovelsById({
		mutation: {
			onSuccess: async () => {
				await queryClient.invalidateQueries({
					queryKey: getGetNovelsQueryKey(),
				});
				toast.success("Novel deleted");
				closeDelete();
			},
			onError: (reason) => setDeleteError(errorMessage(reason)),
		},
	});

	return (
		<>
			<PageHeader
				title="Novels"
				description="The shared catalogue readers highlight in the extension."
				actions={
					can(PERMISSIONS.novels.create) && (
						<Button
							variant="primary"
							icon={<Plus size={16} strokeWidth={1.75} aria-hidden />}
							onClick={() => setEditing("new")}
						>
							New novel
						</Button>
					)
				}
			/>
			<div className="card">
				<div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
					<SearchInput
						label="Search novels"
						placeholder="Search name, description or slug"
						value={values.search}
						onChange={(search) => set({ search })}
					/>
					<select
						className="input w-auto"
						aria-label="Sort novels"
						value={values.sort || "newest"}
						onChange={(event) =>
							set({
								sort: event.target.value === "newest" ? "" : event.target.value,
							})
						}
					>
						<option value="newest">Newest first</option>
						<option value="name">Name A–Z</option>
					</select>
				</div>
				{novels.error ? (
					<ErrorState
						error={novels.error}
						onRetry={() => void novels.refetch()}
					/>
				) : !novels.data ? (
					<TableSkeleton columns={5} />
				) : novels.data.data.length === 0 ? (
					<EmptyState title="No novels found">Try another search.</EmptyState>
				) : (
					<>
						<div className="overflow-x-auto">
							<table className="data-table">
								<thead>
									<tr>
										<th scope="col">Novel</th>
										<th scope="col">Keywords</th>
										<th scope="col">Chapters</th>
										<th scope="col">Replacements</th>
										<th scope="col">Added</th>
										<th scope="col">
											<span className="sr-only">Actions</span>
										</th>
									</tr>
								</thead>
								<tbody>
									{novels.data.data.map((novel) => (
										<tr key={novel.id}>
											<td>
												<div className="flex items-center gap-3">
													<div className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg border border-line bg-wash text-muted">
														{novel.image ? (
															<img
																src={novel.image.url}
																alt=""
																loading="lazy"
																width={40}
																height={40}
																className="size-full object-cover"
															/>
														) : (
															<BookOpen
																size={16}
																strokeWidth={1.75}
																aria-hidden
															/>
														)}
													</div>
													<div className="min-w-0">
														<p className="font-medium capitalize">
															{novel.name}
														</p>
														<p className="flex flex-wrap items-center gap-2 text-xs text-muted">
															{novel.slugs.length > 0
																? novel.slugs.join(", ")
																: "No slugs"}
															{!novel.context && (
																<span className="badge badge-warning">
																	No AI context
																</span>
															)}
														</p>
													</div>
												</div>
											</td>
											<td className="tabular-nums">
												{formatNumber(novel.counts.keywords)}
											</td>
											<td className="tabular-nums">
												{formatNumber(novel.counts.chapters)}
											</td>
											<td className="tabular-nums">
												{formatNumber(novel.counts.replacements)}
											</td>
											<td className="whitespace-nowrap text-muted">
												{formatDate(novel.createdAt)}
											</td>
											<td>
												<div className="flex justify-end gap-1">
													{can(PERMISSIONS.novels.update) && (
														<Button
															variant="ghost"
															iconOnly
															aria-label={`Edit ${novel.name}`}
															title="Edit"
															onClick={() => setEditing(novel)}
															icon={
																<Pencil
																	size={16}
																	strokeWidth={1.75}
																	aria-hidden
																/>
															}
														/>
													)}
													{can(PERMISSIONS.novels.delete) && (
														<Button
															variant="ghost"
															iconOnly
															className="text-danger"
															aria-label={`Delete ${novel.name}`}
															title="Delete"
															onClick={() => setDeleting(novel)}
															icon={
																<Trash2
																	size={16}
																	strokeWidth={1.75}
																	aria-hidden
																/>
															}
														/>
													)}
												</div>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
						<Pagination
							page={page}
							pageSize={PAGE_SIZE}
							total={novels.data.total}
							onPage={(next) => set({ page: next })}
						/>
					</>
				)}
			</div>

			<Dialog
				open={editing !== null}
				onClose={() => setEditing(null)}
				title={editing === "new" ? "New novel" : "Edit novel"}
				size="lg"
			>
				{editing !== null && (
					<NovelForm
						key={editing === "new" ? "new" : editing.id}
						novel={editing === "new" ? null : editing}
						onDone={() => setEditing(null)}
					/>
				)}
			</Dialog>

			<ConfirmDialog
				open={deleting !== null}
				title="Delete novel?"
				confirmLabel="Delete novel"
				busy={remove.isPending}
				error={deleteError}
				onClose={closeDelete}
				onConfirm={() => deleting && remove.mutate({ id: deleting.id })}
			>
				<strong className="text-ink capitalize">{deleting?.name}</strong> and
				its {formatNumber(deleting?.counts.keywords ?? 0)} keywords,{" "}
				{formatNumber(deleting?.counts.chapters ?? 0)} chapters and{" "}
				{formatNumber(deleting?.counts.replacements ?? 0)} replacements will be
				deleted for every reader. This can’t be undone.
			</ConfirmDialog>
		</>
	);
}
