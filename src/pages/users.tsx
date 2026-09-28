import { useQueryClient } from "@tanstack/react-query";
import { LogOut, Pencil, Plus, Trash2 } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
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
const PORTAL_LABEL: Record<Portal, string> = {
	admin: "Dashboard",
	user: "Reader",
};

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
	const [portal, setPortal] = useState<Portal>(user?.portal ?? "admin");
	const [values, setValues] = useState({
		name: user?.name ?? "",
		username: user?.username ?? "",
		email: user?.email ?? "",
		password: "",
		roleId: user?.roleId ?? "",
	});
	const [error, setError] = useState("");

	const portalRoles = roles.filter((role) => role.portal === portal);
	useEffect(() => {
		// Keep the chosen role valid for the chosen portal.
		setValues((current) => {
			const options = roles.filter((role) => role.portal === portal);
			if (options.some((role) => role.id === current.roleId)) return current;
			const roleId = options[0]?.id ?? "";
			return roleId === current.roleId ? current : { ...current, roleId };
		});
	}, [roles, portal]);

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

	const submit = (event: FormEvent) => {
		event.preventDefault();
		setError("");
		if (!user) {
			create.mutate({
				data: { ...values, email: values.email.trim(), portal },
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
				...(isSelf ? {} : { portal, roleId: values.roleId }),
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
						? "Leave blank to keep the current password. Changing it signs the user out."
						: "At least 8 characters."
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
			<Field
				label="Portal"
				hint={
					isSelf
						? "You can’t change your own portal or role."
						: "Dashboard users sign in here; readers use the extension."
				}
			>
				<select
					className="input"
					value={portal}
					disabled={isSelf}
					onChange={(e) => setPortal(e.target.value as Portal)}
				>
					<option value="admin">Dashboard</option>
					<option value="user">Reader</option>
				</select>
			</Field>
			<Field label="Role">
				<select
					className="input"
					required
					value={values.roleId}
					disabled={isSelf}
					onChange={(e) => set("roleId")(e.target.value)}
				>
					{portalRoles.length === 0 && (
						<option value="">No roles for this portal</option>
					)}
					{portalRoles.map((role) => (
						<option key={role.id} value={role.id}>
							{role.name}
						</option>
					))}
				</select>
			</Field>
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
					disabled={!values.roleId}
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
		"portal",
		"roleId",
	] as const);
	const [editing, setEditing] = useState<User | "new" | null>(null);
	const [pending, setPending] = useState<Pending>(null);
	const [pendingError, setPendingError] = useState("");

	const params = {
		page,
		pageSize: PAGE_SIZE,
		search: values.search || undefined,
		portal: (values.portal || undefined) as Portal | undefined,
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
				description="Dashboard accounts are created here only. Readers register from the extension or website."
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
						aria-label="Filter by portal"
						value={values.portal}
						onChange={(e) => set({ portal: e.target.value, roleId: "" })}
					>
						<option value="">All portals</option>
						<option value="admin">Dashboard</option>
						<option value="user">Reader</option>
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
									(role) => !values.portal || role.portal === values.portal,
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
										<th scope="col">Portal</th>
										<th scope="col">Role</th>
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
												<span
													className={`badge ${user.portal === "admin" ? "badge-accent" : ""}`}
												>
													{PORTAL_LABEL[user.portal]}
												</span>
											</td>
											<td>
												{user.role ? (
													<span className="text-sm">{user.role.name}</span>
												) : (
													<span className="badge badge-warning">No role</span>
												)}
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
						? "Create a dashboard account, or a verified reader account."
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
