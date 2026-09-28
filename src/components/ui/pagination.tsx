import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatNumber } from "@/lib/format";
import { Button } from "./button";

export function Pagination({
	page,
	pageSize,
	total,
	onPage,
}: {
	page: number;
	pageSize: number;
	total: number;
	onPage: (page: number) => void;
}) {
	const pages = Math.max(1, Math.ceil(total / pageSize));
	const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
	const to = Math.min(total, page * pageSize);

	return (
		<nav
			aria-label="Pagination"
			className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm text-muted"
		>
			<p>
				{formatNumber(from)}–{formatNumber(to)} of {formatNumber(total)}
			</p>
			<div className="flex items-center gap-2">
				<Button
					iconOnly
					aria-label="Previous page"
					title="Previous page"
					disabled={page <= 1}
					onClick={() => onPage(page - 1)}
					icon={<ChevronLeft size={16} strokeWidth={1.75} aria-hidden />}
				/>
				<span className="min-w-20 text-center tabular-nums">
					Page {page} of {pages}
				</span>
				<Button
					iconOnly
					aria-label="Next page"
					title="Next page"
					disabled={page >= pages}
					onClick={() => onPage(page + 1)}
					icon={<ChevronRight size={16} strokeWidth={1.75} aria-hidden />}
				/>
			</div>
		</nav>
	);
}
