import type { ReactNode } from "react";
import {
	createBrowserRouter,
	Link,
	Navigate,
	Outlet,
	RouterProvider,
	useLocation,
} from "react-router";
import { AppShell } from "@/components/layout/app-shell";
import { Forbidden } from "@/components/ui/page";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { AccountPage } from "@/pages/account";
import { ConfigsPage } from "@/pages/configs";
import { LoginPage } from "@/pages/login";
import { NovelsPage } from "@/pages/novels";
import { OverviewPage } from "@/pages/overview";
import { RoleEditorPage } from "@/pages/role-editor";
import { RolesPage } from "@/pages/roles";
import { UsersPage } from "@/pages/users";

function RequireAuth() {
	const auth = useAuth();
	const location = useLocation();
	if (auth.status === "loading") {
		return (
			<div className="grid min-h-dvh place-items-center text-muted">
				<Spinner size={24} label="Loading your account" />
			</div>
		);
	}
	if (auth.status === "signed-out") {
		return (
			<Navigate
				to="/login"
				replace
				state={{ from: location.pathname + location.search }}
			/>
		);
	}
	return <Outlet />;
}

/** Shows the page only when the role holds its permission (the API checks again). */
function Allow({
	permission,
	children,
}: {
	permission: string;
	children: ReactNode;
}) {
	const { can } = useAuth();
	return can(permission) ? children : <Forbidden />;
}

/** The overview is the home page; roles without it land on their first page. */
function Home() {
	const { can } = useAuth();
	if (can(PERMISSIONS.overview)) return <OverviewPage />;
	const first = [
		[PERMISSIONS.users.list, "/users"],
		[PERMISSIONS.roles.list, "/roles"],
		[PERMISSIONS.novels.list, "/novels"],
		[PERMISSIONS.configs.list, "/configs"],
	].find(([permission]) => permission && can(permission));
	return first?.[1] ? <Navigate to={first[1]} replace /> : <Forbidden />;
}

function NotFound() {
	return (
		<div className="card px-6 py-16 text-center">
			<h1 className="text-lg font-semibold">Page not found</h1>
			<p className="mt-1 text-sm text-muted">
				This dashboard page doesn’t exist.
			</p>
			<Link to="/" className="btn btn-secondary mt-4">
				Back to the dashboard
			</Link>
		</div>
	);
}

const router = createBrowserRouter([
	{ path: "/login", element: <LoginPage /> },
	{
		element: <RequireAuth />,
		children: [
			{
				element: <AppShell />,
				children: [
					{ index: true, element: <Home /> },
					{
						path: "users",
						element: (
							<Allow permission={PERMISSIONS.users.list}>
								<UsersPage />
							</Allow>
						),
					},
					{
						path: "roles",
						element: (
							<Allow permission={PERMISSIONS.roles.list}>
								<RolesPage />
							</Allow>
						),
					},
					{ path: "roles/new", element: <RoleEditorPage /> },
					{ path: "roles/:id", element: <RoleEditorPage /> },
					{
						path: "novels",
						element: (
							<Allow permission={PERMISSIONS.novels.list}>
								<NovelsPage />
							</Allow>
						),
					},
					{
						path: "configs",
						element: (
							<Allow permission={PERMISSIONS.configs.list}>
								<ConfigsPage />
							</Allow>
						),
					},
					{ path: "account", element: <AccountPage /> },
					{ path: "*", element: <NotFound /> },
				],
			},
		],
	},
]);

export function App() {
	return <RouterProvider router={router} />;
}
