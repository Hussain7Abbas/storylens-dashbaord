import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Lock } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { errorMessage } from "@/api/axios-instance";
import {
	getGetRolesByIdQueryKey,
	getGetRolesQueryKey,
	useGetPermissions,
	useGetRolesById,
	usePostRoles,
	usePutRolesById,
} from "@/api/generated/endpoints/admin-roles";
import type { GetPermissions200DataItem } from "@/api/generated/schemas";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import {
	ErrorState,
	Forbidden,
	PageHeader,
	TableSkeleton,
} from "@/components/ui/page";
import { SearchInput } from "@/components/ui/search-input";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth";
import { PERMISSIONS, SUPER_ADMIN_ROLE } from "@/lib/permissions";

type Permission = GetPermissions200DataItem;
type Portal = "admin" | "user";

const GROUP_LABELS: Record<string, string> = {
	ai: "AI",
	auth: "Account",
	stats: "Overview",
	moderation: "Moderation",
	"keywords-chapters": "Keyword–chapter links",
};

function groupLabel(group: string): string {
	return (
		GROUP_LABELS[group] ??
		group.replace(/-/g, " ").replace(/^\w/, (letter) => letter.toUpperCase())
	);
}

function MethodBadge({ method }: { method: string | null }) {
	if (!method) return <span className="method">CAP</span>;
	return (
		<span className={`method method-${method.toLowerCase()}`}>{method}</span>
	);
}

function GroupToggle({
	label,
	checked,
	indeterminate,
	disabled,
	onChange,
}: {
	label: string;
	checked: boolean;
	indeterminate: boolean;
	disabled: boolean;
	onChange: (checked: boolean) => void;
}) {
	const ref = useRef<HTMLInputElement>(null);
	useEffect(() => {
		if (ref.current) ref.current.indeterminate = indeterminate;
	}, [indeterminate]);
	return (
		<label className="flex items-center gap-2 text-sm font-medium">
			<input
				ref={ref}
				type="checkbox"
				className="size-4 accent-[var(--accent)]"
				checked={checked}
				disabled={disabled}
				onChange={(event) => onChange(event.target.checked)}
			/>
			{label}
		</label>
	);
}

function PermissionMatrix({
	permissions,
	selected,
	readOnly,
	onChange,
}: {
	permissions: Permission[];
	selected: Set<string>;
	readOnly: boolean;
	onChange: (next: Set<string>) => void;
}) {
	const [filter, setFilter] = useState("");
	const query = filter.toLowerCase();
	const visible = permissions.filter(
		(permission) =>
			!query ||
			permission.key.toLowerCase().includes(query) ||
			(permission.description ?? "").toLowerCase().includes(query),
	);
	const groups = [...new Set(visible.map((permission) => permission.group))];

	const toggle = (ids: string[], on: boolean) => {
		const next = new Set(selected);
		for (const id of ids) {
			if (on) next.add(id);
			else next.delete(id);
		}
		onChange(next);
	};

	return (
		<section className="card" aria-labelledby="permissions-heading">
			<div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
				<div>
					<h2 id="permissions-heading" className="text-base font-semibold">
						Permissions
					</h2>
					<p className="text-sm text-muted">
						{selected.size} of {permissions.length} selected
					</p>
				</div>
				<div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
					<SearchInput
						label="Filter permissions"
						value={filter}
						onChange={setFilter}
					/>
					{!readOnly && (
						<div className="flex gap-2">
							<Button
								onClick={() =>
									toggle(
										permissions.map((p) => p.id),
										true,
									)
								}
							>
								Select all
							</Button>
							<Button onClick={() => onChange(new Set())}>Clear</Button>
						</div>
					)}
				</div>
			</div>
			{groups.length === 0 && (
				<p className="px-5 py-8 text-center text-sm text-muted">
					No permissions match.
				</p>
			)}
			<div className="divide-y divide-line">
				{groups.map((group) => {
					const items = visible.filter(
						(permission) => permission.group === group,
					);
					const count = items.filter((permission) =>
						selected.has(permission.id),
					).length;
					return (
						<fieldset key={group} className="px-5 py-4">
							<legend className="sr-only">{group}</legend>
							<div className="mb-2 flex items-center justify-between gap-3">
								<GroupToggle
									label={groupLabel(group)}
									checked={count === items.length}
									indeterminate={count > 0 && count < items.length}
									disabled={readOnly}
									onChange={(on) =>
										toggle(
											items.map((permission) => permission.id),
											on,
										)
									}
								/>
								<span className="text-xs text-muted tabular-nums">
									{count}/{items.length}
								</span>
							</div>
							<ul className="grid gap-1 md:grid-cols-2">
								{items.map((permission) => (
									<li key={permission.id}>
										<label className="flex min-h-10 items-start gap-3 rounded-lg px-2 py-1.5 hover:bg-wash">
											<input
												type="checkbox"
												className="mt-1 size-4 shrink-0 accent-[var(--accent)]"
												checked={selected.has(permission.id)}
												disabled={readOnly}
												onChange={(event) =>
													toggle([permission.id], event.target.checked)
												}
											/>
											<span className="min-w-0">
												<span className="flex flex-wrap items-center gap-2">
													<MethodBadge method={permission.method} />
													<code className="truncate text-xs text-muted">
														{permission.path ?? permission.key}
													</code>
												</span>
												{permission.description && (
													<span className="mt-0.5 block text-sm">
														{permission.description}
													</span>
												)}
											</span>
										</label>
									</li>
								))}
							</ul>
						</fieldset>
					);
				})}
			</div>
		</section>
	);
}

export function RoleEditorPage() {
	const { id } = useParams();
	const isNew = !id;
	const [search] = useSearchParams();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const toast = useToast();
	const { can } = useAuth();

	const role = useGetRolesById(id ?? "", { query: { enabled: !isNew } });
	const [portal, setPortal] = useState<Portal>(
		search.get("portal") === "user" ? "user" : "admin",
	);
	const effectivePortal: Portal = role.data?.portal ?? portal;
	const permissions = useGetPermissions({ portal: effectivePortal });

	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [error, setError] = useState("");

	useEffect(() => {
		if (!role.data) return;
		setName(role.data.name);
		setDescription(role.data.description ?? "");
		setSelected(new Set(role.data.permissionIds));
	}, [role.data]);

	const isSuperAdmin = role.data?.slug === SUPER_ADMIN_ROLE;
	const canSave = isNew
		? can(PERMISSIONS.roles.create)
		: can(PERMISSIONS.roles.update);
	const readOnly = !canSave || isSuperAdmin;

	const onSuccess = async (saved: { id: string }) => {
		await Promise.all([
			queryClient.invalidateQueries({ queryKey: getGetRolesQueryKey() }),
			queryClient.invalidateQueries({
				queryKey: getGetRolesByIdQueryKey(saved.id),
			}),
		]);
		toast.success(isNew ? "Role created" : "Role saved");
		navigate("/roles");
	};
	const onError = (reason: unknown) => setError(errorMessage(reason));
	const create = usePostRoles({ mutation: { onSuccess, onError } });
	const update = usePutRolesById({ mutation: { onSuccess, onError } });

	const sortedPermissions = useMemo(
		() => permissions.data?.data ?? [],
		[permissions.data],
	);

	if (
		!can(PERMISSIONS.roles.permissions) ||
		(!isNew && !can(PERMISSIONS.roles.view))
	)
		return <Forbidden />;

	const submit = (event: FormEvent) => {
		event.preventDefault();
		setError("");
		const permissionIds = [...selected];
		if (isNew) {
			create.mutate({
				data: {
					name,
					description: description || undefined,
					portal,
					permissionIds,
				},
			});
		} else if (id) {
			update.mutate({
				id,
				data: { name, description, ...(isSuperAdmin ? {} : { permissionIds }) },
			});
		}
	};

	const loadError = role.error ?? permissions.error;

	return (
		<>
			<Link
				to="/roles"
				className="mb-4 inline-flex items-center gap-2 text-sm text-muted hover:text-ink"
			>
				<ArrowLeft size={16} strokeWidth={1.75} aria-hidden />
				Roles
			</Link>
			<PageHeader
				title={isNew ? "New role" : (role.data?.name ?? "Role")}
				description={
					effectivePortal === "admin"
						? "Dashboard role: grants endpoints of the dashboard API (/api/admin)."
						: "Reader role: grants endpoints of the extension and desktop-client API (/api/user)."
				}
			/>
			{loadError ? (
				<div className="card">
					<ErrorState
						error={loadError}
						onRetry={() => {
							void role.refetch();
							void permissions.refetch();
						}}
					/>
				</div>
			) : (
				<form onSubmit={submit} className="space-y-6">
					<section
						className="card grid gap-4 p-5 md:grid-cols-2"
						aria-label="Role details"
					>
						<Field label="Name">
							<input
								className="input"
								required
								maxLength={60}
								value={name}
								disabled={!canSave}
								onChange={(event) => setName(event.target.value)}
							/>
						</Field>
						<Field
							label="Portal"
							hint={
								isNew
									? "Can’t be changed after the role is created."
									: undefined
							}
						>
							<select
								className="input"
								value={effectivePortal}
								disabled={!isNew}
								onChange={(event) => {
									setPortal(event.target.value as Portal);
									setSelected(new Set());
								}}
							>
								<option value="admin">Dashboard</option>
								<option value="user">Reader</option>
							</select>
						</Field>
						<Field label="Description" className="md:col-span-2">
							<textarea
								className="input"
								maxLength={300}
								rows={2}
								value={description}
								disabled={!canSave}
								onChange={(event) => setDescription(event.target.value)}
							/>
						</Field>
						{isSuperAdmin && (
							<p className="flex items-center gap-2 text-sm text-muted md:col-span-2">
								<Lock size={16} strokeWidth={1.75} aria-hidden />
								Super Admin always holds every dashboard permission, including
								new ones.
							</p>
						)}
					</section>

					{permissions.data ? (
						<PermissionMatrix
							permissions={sortedPermissions}
							selected={selected}
							readOnly={readOnly}
							onChange={setSelected}
						/>
					) : (
						<div className="card">
							<TableSkeleton rows={8} columns={2} />
						</div>
					)}

					{canSave && (
						<div className="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-end gap-3 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-card sm:border">
							{error && (
								<p className="field-error mr-auto mt-0" role="alert">
									{error}
								</p>
							)}
							<Link to="/roles" className="btn btn-secondary">
								Cancel
							</Link>
							<Button
								type="submit"
								variant="primary"
								loading={create.isPending || update.isPending}
							>
								{isNew ? "Create role" : "Save role"}
							</Button>
						</div>
					)}
				</form>
			)}
		</>
	);
}
