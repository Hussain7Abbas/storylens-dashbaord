import { useQueryClient } from "@tanstack/react-query";
import { Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { errorMessage } from "@/api/axios-instance";
import {
	getGetRolesQueryKey,
	useDeleteRolesById,
	useGetRoles,
} from "@/api/generated/endpoints/admin-roles";
import type { GetRoles200DataItem } from "@/api/generated/schemas";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
	EmptyState,
	ErrorState,
	PageHeader,
	TableSkeleton,
} from "@/components/ui/page";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth";
import { formatNumber } from "@/lib/format";
import { PERMISSIONS } from "@/lib/permissions";

type Role = GetRoles200DataItem;

const PORTALS = [
	{
		value: "admin",
		title: "Dashboard roles",
		description: "Control what dashboard users can see and change here.",
	},
	{
		value: "user",
		title: "Reader roles",
		description:
			"Control what extension and desktop-client accounts can do. New guests get Guest; registered readers get Reader.",
	},
] as const;

function RoleTable({
	roles,
	onDelete,
}: {
	roles: Role[];
	onDelete: (role: Role) => void;
}) {
	const { can } = useAuth();
	if (roles.length === 0) return <EmptyState title="No roles yet" />;

	return (
		<div className="relative overflow-x-auto">
			<table className="data-table">
				<thead>
					<tr>
						<th scope="col">Role</th>
						<th scope="col">Users</th>
						<th scope="col">Permissions</th>
						<th scope="col">
							<span className="sr-only">Actions</span>
						</th>
					</tr>
				</thead>
				<tbody>
					{roles.map((role) => (
						<tr key={role.id}>
							<td>
								<p className="flex items-center gap-2 font-medium">
									{role.name}
									{role.isSystem && (
										<span
											className="badge"
											title="Created by the system; it can’t be deleted"
										>
											<Lock size={12} strokeWidth={1.75} aria-hidden />
											System
										</span>
									)}
								</p>
								{role.description && (
									<p className="max-w-xl text-xs text-muted">
										{role.description}
									</p>
								)}
							</td>
							<td className="tabular-nums">{formatNumber(role.userCount)}</td>
							<td className="tabular-nums">
								{formatNumber(role.permissionIds.length)}
							</td>
							<td>
								<div className="flex justify-end gap-1">
									{can(PERMISSIONS.roles.view) && (
										<Link
											to={`/roles/${role.id}`}
											className="btn btn-ghost btn-icon"
											aria-label={`${can(PERMISSIONS.roles.update) ? "Edit" : "View"} ${role.name}`}
											title={can(PERMISSIONS.roles.update) ? "Edit" : "View"}
										>
											<Pencil size={16} strokeWidth={1.75} aria-hidden />
										</Link>
									)}
									{can(PERMISSIONS.roles.delete) && !role.isSystem && (
										<Button
											variant="ghost"
											iconOnly
											className="text-danger"
											aria-label={`Delete ${role.name}`}
											title="Delete"
											onClick={() => onDelete(role)}
											icon={<Trash2 size={16} strokeWidth={1.75} aria-hidden />}
										/>
									)}
								</div>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

export function RolesPage() {
	const { can } = useAuth();
	const toast = useToast();
	const queryClient = useQueryClient();
	const roles = useGetRoles();
	const [deleting, setDeleting] = useState<Role | null>(null);
	const [deleteError, setDeleteError] = useState("");

	const close = () => {
		setDeleting(null);
		setDeleteError("");
	};
	const remove = useDeleteRolesById({
		mutation: {
			onSuccess: async () => {
				await queryClient.invalidateQueries({
					queryKey: getGetRolesQueryKey(),
				});
				toast.success("Role deleted");
				close();
			},
			onError: (reason) => setDeleteError(errorMessage(reason)),
		},
	});

	const canCreate =
		can(PERMISSIONS.roles.create) && can(PERMISSIONS.roles.permissions);

	return (
		<>
			<PageHeader
				title="Roles"
				description="A role is a set of permissions. Every API endpoint has its own permission, so a role grants exactly the endpoints it lists."
			/>
			<div className="space-y-6">
				{PORTALS.map((portal) => (
					<section
						key={portal.value}
						className="card"
						aria-labelledby={`roles-${portal.value}`}
					>
						<div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
							<div>
								<h2
									id={`roles-${portal.value}`}
									className="text-base font-semibold"
								>
									{portal.title}
								</h2>
								<p className="text-sm text-muted">{portal.description}</p>
							</div>
							{canCreate && (
								<Link
									to={`/roles/new?portal=${portal.value}`}
									className="btn btn-secondary"
								>
									<Plus size={16} strokeWidth={1.75} aria-hidden />
									New role
								</Link>
							)}
						</div>
						{roles.error ? (
							<ErrorState
								error={roles.error}
								onRetry={() => void roles.refetch()}
							/>
						) : !roles.data ? (
							<TableSkeleton rows={3} columns={3} />
						) : (
							<RoleTable
								roles={roles.data.data.filter(
									(role) => role.portal === portal.value,
								)}
								onDelete={setDeleting}
							/>
						)}
					</section>
				))}
			</div>

			<ConfirmDialog
				open={deleting !== null}
				title="Delete role?"
				confirmLabel="Delete role"
				busy={remove.isPending}
				error={deleteError}
				onClose={close}
				onConfirm={() => deleting && remove.mutate({ id: deleting.id })}
			>
				<strong className="text-ink">{deleting?.name}</strong> and its
				permission list will be deleted. Roles that still have users can’t be
				deleted; move those users first.
			</ConfirmDialog>
		</>
	);
}
