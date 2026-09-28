import "@fontsource-variable/inter";
import "./styles/globals.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app";
import { ToastProvider } from "./components/ui/toast";
import { AuthProvider } from "./lib/auth";
import { applySavedTheme } from "./lib/theme";

applySavedTheme();

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 30_000,
			refetchOnWindowFocus: false,
			// Permission and missing-record errors will not change on retry.
			retry: (failureCount, error) => {
				const status = (error as { response?: { status?: number } }).response
					?.status;
				return status !== undefined && status < 500 ? false : failureCount < 2;
			},
		},
	},
});

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");

createRoot(root).render(
	<StrictMode>
		<QueryClientProvider client={queryClient}>
			<ToastProvider>
				<AuthProvider>
					<App />
				</AuthProvider>
			</ToastProvider>
		</QueryClientProvider>
	</StrictMode>,
);
