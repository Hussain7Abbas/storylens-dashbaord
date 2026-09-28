import { LogIn } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Navigate, useLocation } from "react-router";
import { errorMessage } from "@/api/axios-instance";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { useAuth } from "@/lib/auth";

// Dashboard accounts are created by other dashboard users, so there is no
// sign-up link here; readers register from the extension and website.
export function LoginPage() {
	const auth = useAuth();
	const location = useLocation();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);

	if (auth.status === "signed-in") {
		const from = (location.state as { from?: string } | null)?.from ?? "/";
		return <Navigate to={from} replace />;
	}

	const submit = async (event: FormEvent) => {
		event.preventDefault();
		setError("");
		setBusy(true);
		try {
			await auth.signIn(email.trim(), password);
		} catch (reason) {
			setError(errorMessage(reason, "Could not sign in. Try again."));
		} finally {
			setBusy(false);
		}
	};

	return (
		<main className="grid min-h-dvh place-items-center px-4 py-10">
			<div className="w-full max-w-sm">
				<div className="mb-8 flex flex-col items-center text-center">
					<img
						src="/logo.png"
						alt=""
						width={56}
						height={56}
						className="mb-4 size-14 rounded-2xl"
					/>
					<h1 className="text-2xl font-semibold tracking-tight">
						Story Lens Dashboard
					</h1>
					<p className="mt-1 text-sm text-muted">
						Sign in with your dashboard account.
					</p>
				</div>
				<form className="card space-y-4 p-6" onSubmit={submit} noValidate>
					<Field label="Email">
						<input
							className="input"
							type="email"
							name="email"
							autoComplete="username"
							required
							value={email}
							onChange={(event) => setEmail(event.target.value)}
						/>
					</Field>
					<Field label="Password">
						<input
							className="input"
							type="password"
							name="password"
							autoComplete="current-password"
							required
							value={password}
							onChange={(event) => setPassword(event.target.value)}
						/>
					</Field>
					{error && (
						<p className="field-error" role="alert">
							{error}
						</p>
					)}
					<Button
						type="submit"
						variant="primary"
						className="w-full"
						loading={busy}
						disabled={!email || !password}
						icon={<LogIn size={16} strokeWidth={1.75} aria-hidden />}
					>
						Sign in
					</Button>
				</form>
				<p className="mt-6 text-center text-xs text-muted">
					Dashboard accounts are added by an administrator. Readers sign in from
					the Story Lens extension.
				</p>
			</div>
		</main>
	);
}
