import { useQueryClient } from "@tanstack/react-query";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import {
	getAuthMe,
	postAuthLogin,
	postAuthLogout,
} from "@/api/generated/endpoints/admin-auth";
import type { GetAuthMe200 } from "@/api/generated/schemas";
import { getToken, onTokenChange, setToken } from "./session";

export type DashboardUser = GetAuthMe200;

type AuthState =
	| { status: "loading"; user: null }
	| { status: "signed-out"; user: null }
	| { status: "signed-in"; user: DashboardUser };

type AuthContextValue = AuthState & {
	signIn: (email: string, password: string) => Promise<void>;
	signOut: () => Promise<void>;
	/** Reloads the account, e.g. after its role or profile changes. */
	refresh: () => Promise<void>;
	can: (permission: string) => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
	const queryClient = useQueryClient();
	const [state, setState] = useState<AuthState>(() =>
		getToken()
			? { status: "loading", user: null }
			: { status: "signed-out", user: null },
	);

	const refresh = useCallback(async () => {
		if (!getToken()) {
			setState({ status: "signed-out", user: null });
			return;
		}
		try {
			const user = await getAuthMe();
			setState({ status: "signed-in", user });
		} catch {
			// A 401 clears the token in the Axios interceptor.
			if (!getToken()) setState({ status: "signed-out", user: null });
		}
	}, []);

	useEffect(() => {
		void refresh();
		return onTokenChange((token) => {
			if (!token) {
				queryClient.clear();
				setState({ status: "signed-out", user: null });
			}
		});
	}, [refresh, queryClient]);

	const signIn = useCallback(async (email: string, password: string) => {
		const { user, token } = await postAuthLogin({ email, password });
		setToken(token);
		setState({ status: "signed-in", user });
	}, []);

	const signOut = useCallback(async () => {
		try {
			await postAuthLogout();
		} catch {
			// Signing out locally is enough when the API is unreachable.
		}
		setToken(null);
	}, []);

	const value = useMemo<AuthContextValue>(() => {
		const permissions = new Set(state.user?.permissions ?? []);
		return {
			...state,
			signIn,
			signOut,
			refresh,
			can: (permission) => permissions.has(permission),
		};
	}, [state, signIn, signOut, refresh]);

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
	const value = useContext(AuthContext);
	if (!value) throw new Error("useAuth must be used inside AuthProvider");
	return value;
}

/** The signed-in account; only use below the authenticated layout. */
export function useCurrentUser(): DashboardUser {
	const auth = useAuth();
	if (auth.status !== "signed-in") throw new Error("Not signed in");
	return auth.user;
}
