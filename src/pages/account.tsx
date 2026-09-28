import { type FormEvent, useState } from "react";
import { errorMessage } from "@/api/axios-instance";
import {
	usePutAuthMe,
	usePutAuthPassword,
} from "@/api/generated/endpoints/admin-auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page";
import { useToast } from "@/components/ui/toast";
import { useAuth, useCurrentUser } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";

function ProfileForm() {
	const { can, refresh } = useAuth();
	const user = useCurrentUser();
	const toast = useToast();
	const [name, setName] = useState(user.name);
	const [username, setUsername] = useState(user.username);
	const [error, setError] = useState("");
	const editable = can(PERMISSIONS.account.update);
	const save = usePutAuthMe({
		mutation: {
			onSuccess: async () => {
				await refresh();
				toast.success("Profile saved");
			},
			onError: (reason) => setError(errorMessage(reason)),
		},
	});

	const submit = (event: FormEvent) => {
		event.preventDefault();
		setError("");
		save.mutate({ data: { name: name.trim(), username: username.trim() } });
	};

	return (
		<form
			onSubmit={submit}
			className="card grid gap-4 p-5"
			aria-labelledby="profile-heading"
		>
			<h2 id="profile-heading" className="text-base font-semibold">
				Profile
			</h2>
			<Field label="Display name">
				<input
					className="input"
					required
					maxLength={100}
					value={name}
					disabled={!editable}
					onChange={(event) => setName(event.target.value)}
				/>
			</Field>
			<Field label="Username">
				<input
					className="input"
					required
					minLength={3}
					maxLength={30}
					autoComplete="username"
					value={username}
					disabled={!editable}
					onChange={(event) => setUsername(event.target.value)}
				/>
			</Field>
			<dl className="grid gap-3 text-sm sm:grid-cols-2">
				<div>
					<dt className="text-muted">Email</dt>
					<dd className="font-medium break-all">{user.email}</dd>
				</div>
				<div>
					<dt className="text-muted">Role</dt>
					<dd className="font-medium">{user.role?.name ?? "No role"}</dd>
				</div>
			</dl>
			{error && (
				<p className="field-error" role="alert">
					{error}
				</p>
			)}
			{editable && (
				<div className="flex justify-end">
					<Button type="submit" variant="primary" loading={save.isPending}>
						Save profile
					</Button>
				</div>
			)}
		</form>
	);
}

function PasswordForm() {
	const toast = useToast();
	const [currentPassword, setCurrentPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [confirm, setConfirm] = useState("");
	const [error, setError] = useState("");
	const change = usePutAuthPassword({
		mutation: {
			onSuccess: () => {
				setCurrentPassword("");
				setNewPassword("");
				setConfirm("");
				toast.success("Password changed. Other sessions were signed out.");
			},
			onError: (reason) => setError(errorMessage(reason)),
		},
	});

	const mismatch = confirm.length > 0 && confirm !== newPassword;

	const submit = (event: FormEvent) => {
		event.preventDefault();
		setError("");
		if (newPassword !== confirm)
			return setError("The new passwords don’t match.");
		change.mutate({ data: { currentPassword, newPassword } });
	};

	return (
		<form
			onSubmit={submit}
			className="card grid gap-4 p-5"
			aria-labelledby="password-heading"
		>
			<h2 id="password-heading" className="text-base font-semibold">
				Password
			</h2>
			{/* Lets password managers pair the new password with this account. */}
			<input
				type="text"
				name="username"
				autoComplete="username"
				className="hidden"
				readOnly
				aria-hidden
				tabIndex={-1}
			/>
			<Field label="Current password">
				<input
					className="input"
					type="password"
					required
					autoComplete="current-password"
					value={currentPassword}
					onChange={(event) => setCurrentPassword(event.target.value)}
				/>
			</Field>
			<Field
				label="New password"
				hint="At least 8 characters. If your account also has reader access, this is your extension password too. Other sessions are signed out."
			>
				<input
					className="input"
					type="password"
					required
					minLength={8}
					maxLength={72}
					autoComplete="new-password"
					value={newPassword}
					onChange={(event) => setNewPassword(event.target.value)}
				/>
			</Field>
			<Field
				label="Confirm new password"
				error={mismatch ? "The new passwords don’t match." : undefined}
			>
				<input
					className="input"
					type="password"
					required
					autoComplete="new-password"
					value={confirm}
					onChange={(event) => setConfirm(event.target.value)}
				/>
			</Field>
			{error && (
				<p className="field-error" role="alert">
					{error}
				</p>
			)}
			<div className="flex justify-end">
				<Button
					type="submit"
					variant="primary"
					loading={change.isPending}
					disabled={mismatch}
				>
					Change password
				</Button>
			</div>
		</form>
	);
}

export function AccountPage() {
	const { can } = useAuth();
	return (
		<>
			<PageHeader
				title="Account"
				description="Your dashboard profile and sign-in password."
			/>
			<div className="grid gap-6 lg:grid-cols-2">
				<ProfileForm />
				{can(PERMISSIONS.account.password) && <PasswordForm />}
			</div>
		</>
	);
}
