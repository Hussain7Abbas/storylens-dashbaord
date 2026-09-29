import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import {
	type KeyboardEvent,
	useEffect,
	useId,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { getKeywords } from "@/api/generated/endpoints/admin-keywords";
import type { GetKeywordsParams } from "@/api/generated/schemas";
import { bothNames } from "@/lib/translation";
import { Spinner } from "./spinner";

export type PickedKeyword = { id: string; label: string };

const RESULTS = 20;

/**
 * Searchable combobox over one novel's keywords, loaded from the API as the
 * admin types. The list is fixed to the viewport so table cells don't clip it.
 */
export function KeywordPicker({
	novelId,
	excludeId,
	filter,
	value,
	onChange,
	disabled = false,
	label,
	placeholder = "Search…",
}: {
	novelId: string;
	excludeId: string;
	filter?: Pick<GetKeywordsParams, "has" | "missing">;
	value: PickedKeyword | null;
	onChange: (value: PickedKeyword | null) => void;
	disabled?: boolean;
	label: string;
	placeholder?: string;
}) {
	const listId = useId();
	const inputRef = useRef<HTMLInputElement>(null);
	const [open, setOpen] = useState(false);
	const [text, setText] = useState("");
	const [search, setSearch] = useState("");
	const [active, setActive] = useState(0);
	const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });

	useEffect(() => {
		const timer = window.setTimeout(() => setSearch(text.trim()), 250);
		return () => window.clearTimeout(timer);
	}, [text]);

	const results = useQuery({
		queryKey: ["keyword-picker", novelId, filter, search],
		queryFn: async ({ signal }) =>
			(
				await getKeywords(
					{
						novelId,
						search: search || undefined,
						pageSize: RESULTS,
						...filter,
					},
					undefined,
					signal,
				)
			).data.filter((keyword) => keyword.id !== excludeId),
		enabled: open && !!novelId,
		staleTime: 30_000,
	});
	const options = results.data ?? [];

	useLayoutEffect(() => {
		if (!open) return;
		const place = () => {
			const rect = inputRef.current?.getBoundingClientRect();
			if (rect)
				setPosition({
					top: rect.bottom + 4,
					left: rect.left,
					width: rect.width,
				});
		};
		place();
		window.addEventListener("resize", place);
		window.addEventListener("scroll", place, true);
		return () => {
			window.removeEventListener("resize", place);
			window.removeEventListener("scroll", place, true);
		};
	}, [open]);

	const choose = (index: number) => {
		const keyword = options[index];
		if (!keyword) return;
		onChange({ id: keyword.id, label: bothNames(keyword) });
		setText("");
		setOpen(false);
	};

	const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key === "ArrowDown") {
			event.preventDefault();
			setOpen(true);
			setActive((index) => Math.min(index + 1, options.length - 1));
		} else if (event.key === "ArrowUp") {
			event.preventDefault();
			setActive((index) => Math.max(index - 1, 0));
		} else if (event.key === "Enter" && open) {
			event.preventDefault();
			choose(active);
		} else if (event.key === "Escape") {
			setOpen(false);
		}
	};

	if (value) {
		return (
			<div className="flex min-w-40 items-center gap-1">
				<span
					className="badge badge-accent max-w-48 truncate"
					title={value.label}
				>
					{value.label}
				</span>
				<button
					type="button"
					className="btn btn-ghost btn-icon"
					aria-label={`Clear ${label}`}
					title="Clear"
					disabled={disabled}
					onClick={() => onChange(null)}
				>
					<X size={14} strokeWidth={1.75} aria-hidden />
				</button>
			</div>
		);
	}

	return (
		<div className="min-w-40">
			<input
				ref={inputRef}
				className="input"
				role="combobox"
				aria-label={label}
				aria-expanded={open}
				aria-controls={listId}
				aria-autocomplete="list"
				aria-activedescendant={
					open && options[active] ? `${listId}-${active}` : undefined
				}
				placeholder={placeholder}
				disabled={disabled}
				value={text}
				onFocus={() => setOpen(true)}
				onBlur={() => window.setTimeout(() => setOpen(false), 120)}
				onChange={(event) => {
					setText(event.target.value);
					setActive(0);
					setOpen(true);
				}}
				onKeyDown={onKeyDown}
			/>
			{open && (
				<div
					id={listId}
					role="listbox"
					aria-label={label}
					className="card fixed z-50 grid max-h-60 overflow-y-auto p-1 text-sm shadow-lg"
					style={{
						top: position.top,
						left: position.left,
						width: Math.max(position.width, 224),
					}}
				>
					{results.isFetching && options.length === 0 ? (
						<p className="flex items-center gap-2 px-3 py-2 text-muted">
							<Spinner /> Searching…
						</p>
					) : options.length === 0 ? (
						<p className="px-3 py-2 text-muted">No matching keywords</p>
					) : (
						options.map((keyword, index) => (
							<button
								type="button"
								key={keyword.id}
								id={`${listId}-${index}`}
								role="option"
								tabIndex={-1}
								aria-selected={index === active}
								className={`rounded-lg px-3 py-2 text-start ${index === active ? "bg-accent-soft" : ""}`}
								onMouseDown={(event) => event.preventDefault()}
								onMouseEnter={() => setActive(index)}
								onClick={() => choose(index)}
							>
								{bothNames(keyword)}
								{keyword.aliases.length > 0 && (
									<span className="block truncate text-xs text-muted">
										{keyword.aliases.join(", ")}
									</span>
								)}
							</button>
						))
					)}
				</div>
			)}
		</div>
	);
}
