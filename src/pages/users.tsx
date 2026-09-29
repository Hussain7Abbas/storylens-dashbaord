import { useQueryClient } from "@tanstack/react-query";
import { LogOut, Pencil, Plus, Trash2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import { errorMessage } from "@/api/axios-instance";
import { useGetRoles } from "@/api/generated/endpoints/admin-roles";
import {
	getGetUsersQueryKey,
	useDeleteUsersById,
	useDeleteUsersByIdSessions,
	useGetUsers,
	usePostUsers,
	usePutUsersById,
} from "@/api/generated/endpoints/admin-users";
import type {
	GetRoles200DataItem,
	GetUsers200DataItem,
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
import { useAuth, useCurrentUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { PERMISSIONS } from "@/lib/permissions";
import { useSearchState } from "@/lib/use-search-state";

type User = GetUsers200DataItem;
type Role = GetRoles200DataItem;
type Portal = "admin" | "user";

const PAGE_SIZE = 20;

const ACCESS: Record<
	Portal,
	{
		label: string;
		hint: string;
		flag: "isUser" | "isAdmin";
		roleKey: "userRoleId" | "adminRoleId";
	}
> = {
	user: {
		label: "Reader access",
		hint: "Signs in to the extension, website account pages and desktop client.",
		flag: "isUser",
		roleKey: "userRoleId",
	},
	admin: {
		label: "Dashboard access",
		hint: "Signs in to this dashboard.",
		flag: "isAdmin",
		roleKey: "adminRoleId",
	},
};

type AccessValues = {
	isUser: boolean;
	userRoleId: string;
	isAdmin: boolean;
	adminRoleId: string;
};

/** One portal's checkbox and role picker in the user form. */
function AccessSection({
	portal,
	values,
	roles,
	locked,
	onChange,
}: {
	portal: Portal;
	values: AccessValues;
	roles: Role[];
	locked: boolean;
	onChange: (next: Partial<AccessValues>) => void;
}) {
	const { label, hint, flag, roleKey } = ACCESS[portal];
	const options = roles.filter((role) => role.portal === portal);
	const preferredRole = options.find(
		(role) => role.slug === (portal === "user" ? "reader" : "super-admin"),
	);
	const defaultRoleId =
		preferredRole?.id ??
		(portal === "admin" ? options[0]?.id : undefined) ??
		"";
	const enabled = values[flag];
	return (
		<fieldset className="rounded-[var(--control-radius)] border border-line p-4">
			<legend className="sr-only">{label}</legend>
			<label className="flex items-start gap-3">
				<input
					type="checkbox"
					className="mt-1 size-4 shrink-0 accent-[var(--accent)]"
					checked={enabled}
					disabled={locked}
					onChange={(event) =>
						onChange({
							[flag]: event.target.checked,
							// Reader access must not silently default to the Guest role.
							...(event.target.checked && !values[roleKey]
								? { [roleKey]: defaultRoleId }
								: {}),
						})
					}
				/>
				<span>
					<span className="block text-sm font-semibold">{label}</span>
					<span className="block text-xs text-muted">{hint}</span>
				</span>
			</label>
			{enabled && (
				<Field label="Role" className="mt-3">
					<select
						className="input"
						required
						value={values[roleKey]}
						disabled={locked}
						onChange={(event) => onChange({ [roleKey]: event.target.value })}
					>
						{options.length === 0 && (
							<option value="">No roles for this portal</option>
						)}
						{options.map((role) => (
							<option key={role.id} value={role.id}>
								{role.name}
							</option>
						))}
					</select>
				</Field>
			)}
		</fieldset>
	);
}

function UserForm({
	user,
	roles,
	onDone,
}: {
	user: User | null;
	roles: Role[];
	onDone: (saved: boolean) => void;
}) {
	const queryClient = useQueryClient();
	const toast = useToast();
	const me = useCurrentUser();
	const isSelf = user?.id === me.id;
	const [values, setValues] = useState({
		name: user?.name ?? "",
		username: user?.username ?? "",
		email: user?.email ?? "",
		password: "",
	});
	const [access, setAccess] = useState<AccessValues>({
		isUser: user?.isUser ?? false,
		userRoleId: user?.userRoleId ?? "",
		isAdmin: user?.isAdmin ?? true,
		adminRoleId:
			user?.adminRoleId ??
			roles.find(
				(role) => role.slug === "super-admin" && role.portal === "admin",
			)?.id ??
			roles.find((role) => role.portal === "admin")?.id ??
			"",
	});
	const [error, setError] = useState("");

	const onSuccess = async () => {
		await queryClient.invalidateQueries({ queryKey: getGetUsersQueryKey() });
		toast.success(user ? "User updated" : "User created");
		onDone(true);
	};
	const onError = (reason: unknown) => setError(errorMessage(reason));
	const create = usePostUsers({ mutation: { onSuccess, onError } });
	const update = usePutUsersById({ mutation: { onSuccess, onError } });
	const busy = create.isPending || update.isPending;

	const set = (key: keyof typeof values) => (value: string) =>
		setValues((current) => ({ ...current, [key]: value }));

	const hasAccess = access.isUser || access.isAdmin;
	const rolesChosen =
		(!access.isUser || access.userRoleId) &&
		(!access.isAdmin || access.adminRoleId);

	const accessBody = {
		isUser: access.isUser,
		userRoleId: access.isUser ? access.userRoleId : null,
		// You can't change your own dashboard access; the API refuses it too.
		...(isSelf
			? {}
			: {
					isAdmin: access.isAdmin,
					adminRoleId: access.isAdmin ? access.adminRoleId : null,
				}),
	};

	const submit = (event: FormEvent) => {
		event.preventDefault();
		setError("");
		if (!user) {
			create.mutate({
				data: {
					...values,
					email: values.email.trim(),
					isUser: access.isUser,
					userRoleId: access.isUser ? access.userRoleId : null,
					isAdmin: access.isAdmin,
					adminRoleId: access.isAdmin ? access.adminRoleId : null,
				},
			});
			return;
		}
		update.mutate({
			id: user.id,
			data: {
				name: values.name,
				username: values.username,
				email: values.email.trim(),
				...(values.password ? { password: values.password } : {}),
				...accessBody,
			},
		});
	};

	return (
		<form
			id="user-form"
			onSubmit={submit}
			className="grid gap-4 sm:grid-cols-2"
		>
			<Field label="Display name">
				<input
					className="input"
					required
					maxLength={100}
					value={values.name}
					onChange={(e) => set("name")(e.target.value)}
				/>
			</Field>
			<Field label="Username" hint="3–30 characters, unique.">
				<input
					className="input"
					required
					minLength={3}
					maxLength={30}
					autoComplete="off"
					value={values.username}
					onChange={(e) => set("username")(e.target.value)}
				/>
			</Field>
			<Field label="Email" className="sm:col-span-2">
				<input
					className="input"
					type="email"
					required
					autoComplete="off"
					value={values.email}
					onChange={(e) => set("email")(e.target.value)}
				/>
			</Field>
			<Field
				label={user ? "New password" : "Password"}
				hint={
					user
						? "Leave blank to keep the current password. It is shared by both kinds of access; changing it signs the user out everywhere."
						: "At least 8 characters. Used for both kinds of access."
				}
				className="sm:col-span-2"
			>
				<input
					className="input"
					type="password"
					autoComplete="new-password"
					required={!user}
					minLength={8}
					maxLength={72}
					value={values.password}
					onChange={(e) => set("password")(e.target.value)}
				/>
			</Field>
			<div className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
				<AccessSection
					portal="user"
					values={access}
					roles={roles}
					locked={false}
					onChange={(next) => setAccess((current) => ({ ...current, ...next }))}
				/>
				<AccessSection
					portal="admin"
					values={access}
					roles={roles}
					locked={isSelf}
					onChange={(next) => setAccess((current) => ({ ...current, ...next }))}
				/>
			</div>
			{isSelf && (
				<p className="field-hint sm:col-span-2">
					You can’t change your own dashboard access or role.
				</p>
			)}
			{!hasAccess && (
				<p className="field-error sm:col-span-2">
					Choose reader access, dashboard access, or both.
				</p>
			)}
			{error && (
				<p className="field-error sm:col-span-2" role="alert">
					{error}
				</p>
			)}
			<div className="flex justify-end gap-2 sm:col-span-2">
				<Button onClick={() => onDone(false)} disabled={busy}>
					Cancel
				</Button>
				<Button
					type="submit"
					variant="primary"
					loading={busy}
					disabled={!hasAccess || !rolesChosen}
				>
					{user ? "Save changes" : "Create user"}
				</Button>
			</div>
		</form>
	);
}

type Pending = { kind: "delete" | "sign-out"; user: User } | null;

export function UsersPage() {
	const { can } = useAuth();
	const me = useCurrentUser();
	const toast = useToast();
	const queryClient = useQueryClient();
	const { values, page, set } = useSearchState([
		"search",
		"access",
		"roleId",
	] as const);
	const [editing, setEditing] = useState<User | "new" | null>(null);
	const [pending, setPending] = useState<Pending>(null);
	const [pendingError, setPendingError] = useState("");

	const params = {
		page,
		pageSize: PAGE_SIZE,
		search: values.search || undefined,
		access: (values.access || undefined) as Portal | undefined,
		roleId: values.roleId || undefined,
	};
	const users = useGetUsers(params, {
		query: { placeholderData: (previous) => previous },
	});
	const roles = useGetRoles(undefined, {
		query: { enabled: can(PERMISSIONS.roles.list) },
	});
	const roleList = roles.data?.data ?? [];

	const close = () => {
		setPending(null);
		setPendingError("");
	};
	const refresh = () =>
		queryClient.invalidateQueries({ queryKey: getGetUsersQueryKey() });
	const remove = useDeleteUsersById({
		mutation: {
			onSuccess: async () => {
				await refresh();
				toast.success("User deleted");
				close();
			},
			onError: (reason) => setPendingError(errorMessage(reason)),
		},
	});
	const signOut = useDeleteUsersByIdSessions({
		mutation: {
			onSuccess: () => {
				toast.success("User signed out everywhere");
				close();
			},
			onError: (reason) => setPendingError(errorMessage(reason)),
		},
	});

	const canEdit = can(PERMISSIONS.users.update) && can(PERMISSIONS.roles.list);

	return (
		<>
			<PageHeader
				title="Users"
				description="One account can have reader access, dashboard access, or both. Dashboard access is granted here only; readers register from the extension or website."
				actions={
					can(PERMISSIONS.users.create) &&
					can(PERMISSIONS.roles.list) && (
						<Button
							variant="primary"
							icon={<Plus size={16} strokeWidth={1.75} aria-hidden />}
							onClick={() => setEditing("new")}
						>
							New user
						</Button>
					)
				}
			/>

			<div className="card">
				<div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
					<SearchInput
						label="Search users"
						placeholder="Search name, username or email"
						value={values.search}
						onChange={(search) => set({ search })}
					/>
					<select
						className="input w-auto"
						aria-label="Filter by access"
						value={values.access}
						onChange={(e) => set({ access: e.target.value, roleId: "" })}
					>
						<option value="">All access</option>
						<option value="admin">Dashboard access</option>
						<option value="user">Reader access</option>
					</select>
					{roleList.length > 0 && (
						<select
							className="input w-auto"
							aria-label="Filter by role"
							value={values.roleId}
							onChange={(e) => set({ roleId: e.target.value })}
						>
							<option value="">All roles</option>
							{roleList
								.filter(
									(role) => !values.access || role.portal === values.access,
								)
								.map((role) => (
									<option key={role.id} value={role.id}>
										{role.name}
									</option>
								))}
						</select>
					)}
				</div>

				{users.error ? (
					<ErrorState
						error={users.error}
						onRetry={() => void users.refetch()}
					/>
				) : !users.data ? (
					<TableSkeleton columns={5} />
				) : users.data.data.length === 0 ? (
					<EmptyState title="No users found">
						Try another search or filter.
					</EmptyState>
				) : (
					<>
						<div className="overflow-x-auto">
							<table className="data-table">
								<thead>
									<tr>
										<th scope="col">User</th>
										<th scope="col">Access</th>
										<th scope="col">Joined</th>
										<th scope="col">
											<span className="sr-only">Actions</span>
										</th>
									</tr>
								</thead>
								<tbody>
									{users.data.data.map((user) => (
										<tr key={user.id}>
											<td>
												<p className="font-medium">
													{user.name}
													{user.id === me.id && (
														<span className="ml-2 text-xs font-normal text-muted">
															(you)
														</span>
													)}
												</p>
												<p className="text-xs text-muted">
													@{user.username} ·{" "}
													{user.isGuest ? "guest install" : user.email}
												</p>
											</td>
											<td>
												<ul className="flex flex-wrap gap-1.5">
													{user.isAdmin && (
														<li className="badge badge-accent">
															Dashboard · {user.adminRole?.name ?? "no role"}
														</li>
													)}
													{user.isUser && (
														<li className="badge">
															Reader · {user.userRole?.name ?? "no role"}
														</li>
													)}
												</ul>
											</td>
											<td className="whitespace-nowrap text-muted">
												{formatDate(user.createdAt)}
											</td>
											<td>
												<div className="flex justify-end gap-1">
													{canEdit && (
														<Button
															variant="ghost"
															iconOnly
															aria-label={`Edit ${user.username}`}
															title="Edit"
															onClick={() => setEditing(user)}
															icon={
																<Pencil
																	size={16}
																	strokeWidth={1.75}
																	aria-hidden
																/>
															}
														/>
													)}
													{can(PERMISSIONS.users.signOut) && (
														<Button
															variant="ghost"
															iconOnly
															aria-label={`Sign ${user.username} out everywhere`}
															title="Sign out everywhere"
															onClick={() =>
																setPending({ kind: "sign-out", user })
															}
															icon={
																<LogOut
																	size={16}
																	strokeWidth={1.75}
																	aria-hidden
																/>
															}
														/>
													)}
													{can(PERMISSIONS.users.delete) &&
														user.id !== me.id && (
															<Button
																variant="ghost"
																iconOnly
																className="text-danger"
																aria-label={`Delete ${user.username}`}
																title="Delete"
																onClick={() =>
																	setPending({ kind: "delete", user })
																}
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
							total={users.data.total}
							onPage={(next) => set({ page: next })}
						/>
					</>
				)}
			</div>

			<Dialog
				open={editing !== null}
				onClose={() => setEditing(null)}
				title={editing === "new" ? "New user" : "Edit user"}
				description={
					editing === "new"
						? "Create a verified account with dashboard access, reader access, or both."
						: undefined
				}
			>
				{editing !== null && (
					<UserForm
						key={editing === "new" ? "new" : editing.id}
						user={editing === "new" ? null : editing}
						roles={roleList}
						onDone={() => setEditing(null)}
					/>
				)}
			</Dialog>

			<ConfirmDialog
				open={pending?.kind === "delete"}
				title="Delete user?"
				confirmLabel="Delete user"
				busy={remove.isPending}
				error={pendingError}
				onClose={close}
				onConfirm={() => pending && remove.mutate({ id: pending.user.id })}
			>
				<strong className="text-ink">{pending?.user.username}</strong> will be
				deleted and signed out. Novels, keywords and replacements they created
				stay in the catalogue without an owner. This can’t be undone.
			</ConfirmDialog>

			<ConfirmDialog
				open={pending?.kind === "sign-out"}
				title="Sign out everywhere?"
				confirmLabel="Sign out"
				busy={signOut.isPending}
				error={pendingError}
				onClose={close}
				onConfirm={() => pending && signOut.mutate({ id: pending.user.id })}
			>
				Every session of{" "}
				<strong className="text-ink">{pending?.user.username}</strong> ends,
				including the extension and desktop client. They can sign in again with
				their password.
			</ConfirmDialog>
		</>
	);
}
