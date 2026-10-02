import {
	BookOpen,
	Cpu,
	ReceiptText,
	ShieldCheck,
	UserPlus,
	Users,
	Wallet,
} from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { useGetBillingSummary } from "@/api/generated/endpoints/admin-billing";
import { useGetStats } from "@/api/generated/endpoints/admin-overview";
import { LensCoin } from "@/components/ui/lens-coin";
import { EmptyState, ErrorState, PageHeader } from "@/components/ui/page";
import { useAuth } from "@/lib/auth";
import { formatDate, formatNumber } from "@/lib/format";
import { formatUsd } from "@/lib/money";
import { PERMISSIONS } from "@/lib/permissions";
import { bothNames } from "@/lib/translation";

function Stat({
	label,
	value,
	detail,
	icon,
	to,
}: {
	label: string;
	value: number | undefined;
	detail?: string;
	icon: ReactNode;
	to?: string;
}) {
	const body = (
		<>
			<div className="flex items-center justify-between gap-3">
				<p className="text-sm font-medium text-muted">{label}</p>
				<span className="grid size-9 place-items-center rounded-full bg-accent-soft text-accent">
					{icon}
				</span>
			</div>
			<p className="mt-3 text-3xl font-semibold tabular-nums tracking-tight">
				{value === undefined ? (
					<span className="inline-block h-8 w-16 animate-pulse rounded bg-wash motion-reduce:animate-none" />
				) : (
					formatNumber(value)
				)}
			</p>
			{detail && <p className="mt-1 text-xs text-muted">{detail}</p>}
		</>
	);
	return to ? (
		<Link
			to={to}
			className="card block p-5 transition-colors hover:border-accent"
		>
			{body}
		</Link>
	) : (
		<div className="card p-5">{body}</div>
	);
}

const ICON = { size: 18, strokeWidth: 1.75, "aria-hidden": true } as const;

/** Lens sales and Story Lens Cloud AI cost over the last 30 days. */
function BillingOverview() {
	const { can } = useAuth();
	const { data } = useGetBillingSummary({ days: 30 });
	const sold = data ? Number(data.requests.approvedUsd) : 0;
	const cost = data ? Number(data.ai.costWithFeeUsd) : 0;
	const spentValue =
		data?.lensPriceUsd != null
			? data.lenses.spent * Number(data.lensPriceUsd)
			: null;
	return (
		<section aria-labelledby="lenses-heading" className="mt-6">
			<h2
				id="lenses-heading"
				className="mb-3 flex items-center gap-2 text-base font-semibold"
			>
				<LensCoin size={20} />
				<span>Lenses and cloud AI, last 30 days</span>
			</h2>
			<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
				<Stat
					label="Pending requests"
					value={data?.requests.counts.PENDING}
					detail={
						data
							? `${formatNumber(data.requests.pendingLenses)} lenses · ${formatUsd(data.requests.pendingUsd)}`
							: undefined
					}
					icon={<ReceiptText {...ICON} />}
					to={
						can(PERMISSIONS.billing.requests)
							? "/billing-requests?status=PENDING"
							: undefined
					}
				/>
				<Stat
					label="Lenses sold"
					value={data?.requests.approvedLenses}
					detail={
						data
							? `${formatUsd(String(sold))} from ${formatNumber(data.requests.approvedCount)} approved requests`
							: undefined
					}
					icon={<Wallet {...ICON} />}
				/>
				<Stat
					label="Lenses spent on AI"
					value={data?.lenses.spent}
					detail={
						data
							? `Worth ${spentValue === null ? "—" : formatUsd(String(spentValue))} · ${formatNumber(data.lenses.trial + data.lenses.gifts)} given free`
							: undefined
					}
					icon={<Cpu {...ICON} />}
					to={can(PERMISSIONS.aiPricing.list) ? "/ai-pricing" : undefined}
				/>
				<Stat
					label="AI calls"
					value={data?.ai.calls}
					detail={
						data
							? `Cost ${formatUsd(String(cost), 2)} with the OpenRouter fee${data.ai.dataPolicy.allow ? ` · ${formatNumber(data.ai.dataPolicy.allow)} via providers that may keep data` : ""}`
							: undefined
					}
					icon={<Cpu {...ICON} />}
				/>
			</div>
		</section>
	);
}

export function OverviewPage() {
	const { can } = useAuth();
	const { data, error, refetch } = useGetStats();

	return (
		<>
			<PageHeader
				title="Overview"
				description="Accounts, catalogue and configuration at a glance."
			/>
			{error ? (
				<div className="card">
					<ErrorState error={error} onRetry={() => void refetch()} />
				</div>
			) : (
				<>
					<section
						aria-label="Totals"
						className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
					>
						<Stat
							label="Readers"
							value={data?.users.readers}
							detail={
								data
									? `${formatNumber(data.users.guests)} guest installs`
									: undefined
							}
							icon={<Users {...ICON} />}
							to={
								can(PERMISSIONS.users.list) ? "/users?portal=user" : undefined
							}
						/>
						<Stat
							label="New this week"
							value={data?.users.newThisWeek}
							detail="Accounts created in the last 7 days"
							icon={<UserPlus {...ICON} />}
						/>
						<Stat
							label="Novels"
							value={data?.content.novels}
							detail={
								data
									? `${formatNumber(data.content.keywords)} keywords · ${formatNumber(data.content.replacements)} replacements`
									: undefined
							}
							icon={<BookOpen {...ICON} />}
							to={can(PERMISSIONS.novels.list) ? "/novels" : undefined}
						/>
						<Stat
							label="Dashboard users"
							value={data?.users.dashboard}
							detail={
								data
									? `${formatNumber(data.roles)} roles · ${formatNumber(data.configs)} configs`
									: undefined
							}
							icon={<ShieldCheck {...ICON} />}
							to={
								can(PERMISSIONS.users.list) ? "/users?portal=admin" : undefined
							}
						/>
					</section>

					{can(PERMISSIONS.billing.summary) && <BillingOverview />}

					<div className="mt-6 grid gap-6 lg:grid-cols-2">
						<section className="card" aria-labelledby="recent-users">
							<h2
								id="recent-users"
								className="border-b border-line px-5 py-4 text-base font-semibold"
							>
								Newest accounts
							</h2>
							{data && data.recentUsers.length === 0 ? (
								<EmptyState title="No accounts yet" />
							) : (
								<ul className="divide-y divide-line">
									{(data?.recentUsers ?? []).map((user) => (
										<li
											key={user.id}
											className="flex items-center justify-between gap-3 px-5 py-3"
										>
											<div className="min-w-0">
												<p className="truncate text-sm font-medium">
													{can(PERMISSIONS.users.view) ? (
														<Link
															to={`/users?search=${encodeURIComponent(user.username)}`}
															className="hover:text-accent"
														>
															{user.username}
														</Link>
													) : (
														user.username
													)}
												</p>
												<p className="truncate text-xs text-muted">
													{user.isGuest ? "Guest install" : user.email}
												</p>
											</div>
											<div className="flex shrink-0 items-center gap-2">
												{user.isAdmin && (
													<span className="badge badge-accent">Dashboard</span>
												)}
												{user.isUser && <span className="badge">Reader</span>}
												<span className="text-xs text-muted">
													{formatDate(user.createdAt)}
												</span>
											</div>
										</li>
									))}
								</ul>
							)}
						</section>

						<section className="card" aria-labelledby="recent-novels">
							<h2
								id="recent-novels"
								className="border-b border-line px-5 py-4 text-base font-semibold"
							>
								Latest novels
							</h2>
							{data && data.recentNovels.length === 0 ? (
								<EmptyState title="No novels yet" />
							) : (
								<ul className="divide-y divide-line">
									{(data?.recentNovels ?? []).map((novel) => (
										<li
											key={novel.id}
											className="flex items-center justify-between gap-3 px-5 py-3"
										>
											<p className="flex min-w-0 items-center gap-2 text-sm font-medium">
												<BookOpen
													size={14}
													strokeWidth={1.75}
													aria-hidden
													className="shrink-0 text-muted"
												/>
												<span className="truncate capitalize">
													{bothNames(novel)}
												</span>
											</p>
											<span className="shrink-0 text-xs text-muted">
												{formatDate(novel.createdAt)}
											</span>
										</li>
									))}
								</ul>
							)}
						</section>
					</div>
				</>
			)}
		</>
	);
}
