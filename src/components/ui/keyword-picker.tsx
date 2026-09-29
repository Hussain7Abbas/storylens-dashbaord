import { X } from "lucide-react";
import {
	type CSSProperties,
	type KeyboardEvent,
	useDeferredValue,
	useId,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { fuzzyScore, normalizeForSearch } from "@/lib/fuzzy";
import { useNovelKeywords } from "@/lib/novel-keywords";
import { bothNames } from "@/lib/translation";
import { Spinner } from "./spinner";

export type PickedKeyword = {
	id: string;
	label: string;
	nameAr: string | null;
	nameEn: string | null;
};

const RESULTS = 20;
const MIN_WIDTH = 224;
const MAX_HEIGHT = 240;
/** Gap between the list and its input, and between the list and the viewport edge. */
const GAP = 4;
const EDGE = 8;
/** An alias match ranks a little below the same match on a name. */
const ALIAS_WEIGHT = 0.9;

/**
 * Searchable combobox over one novel's keywords in both languages. The novel's
 * keywords load once and are fuzzy-matched as the admin types (typos, Arabic
 * spelling variants and aliases included). The list is fixed to the viewport
 * so table cells don't clip it.
 */
export function KeywordPicker({
	novelId,
	excludeId,
	value,
	onChange,
	disabled = false,
	label,
	placeholder = "Search…",
}: {
	novelId: string;
	excludeId: string;
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
	const search = normalizeForSearch(useDeferredValue(text));
	const [active, setActive] = useState(0);
	const [position, setPosition] = useState<CSSProperties>({});

	const keywords = useNovelKeywords(novelId, open);
	const index = useMemo(
		() =>
			(keywords.data ?? [])
				.filter((keyword) => keyword.id !== excludeId)
				.map((keyword) => ({
					keyword,
					names: [keyword.nameAr, keyword.nameEn]
						.filter((name): name is string => !!name)
						.map(normalizeForSearch),
					aliases: keyword.aliases.map(normalizeForSearch),
				})),
		[keywords.data, excludeId],
	);
	const options = useMemo(() => {
		if (!search) return index.slice(0, RESULTS).map((entry) => entry.keyword);
		return index
			.map((entry) => ({
				keyword: entry.keyword,
				score: Math.max(
					0,
					...entry.names.map((name) => fuzzyScore(search, name)),
					...entry.aliases.map(
						(alias) => fuzzyScore(search, alias) * ALIAS_WEIGHT,
					),
				),
			}))
			.filter((entry) => entry.score > 0)
			.sort((a, b) => b.score - a.score)
			.slice(0, RESULTS)
			.map((entry) => entry.keyword);
	}, [index, search]);

	useLayoutEffect(() => {
		if (!open) return;
		const place = () => {
			const rect = inputRef.current?.getBoundingClientRect();
			if (!rect) return;
			// At least MIN_WIDTH wide, and kept inside the viewport on narrow screens.
			const room = document.documentElement.clientWidth - 2 * EDGE;
			const width = Math.min(Math.max(rect.width, MIN_WIDTH), room);
			const left = Math.max(EDGE, Math.min(rect.left, EDGE + room - width));
			// Opens upwards when the input is near the bottom of the screen.
			const height = document.documentElement.clientHeight;
			const below = height - rect.bottom - GAP - EDGE;
			const above = rect.top - GAP - EDGE;
			setPosition(
				below < MAX_HEIGHT && above > below
					? {
							bottom: height - rect.top + GAP,
							left,
							width,
							maxHeight: Math.min(MAX_HEIGHT, above),
						}
					: {
							top: rect.bottom + GAP,
							left,
							width,
							maxHeight: Math.min(MAX_HEIGHT, below),
						},
			);
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
		onChange({
			id: keyword.id,
			label: bothNames(keyword),
			nameAr: keyword.nameAr,
			nameEn: keyword.nameEn,
		});
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
					className="card fixed z-50 grid overflow-y-auto p-1 text-sm shadow-lg"
					style={position}
				>
					{keywords.isPending ? (
						<p className="flex items-center gap-2 px-3 py-2 text-muted">
							<Spinner /> <span>Loading keywords…</span>
						</p>
					) : keywords.error ? (
						<p className="px-3 py-2 text-danger">Keywords could not load</p>
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
								<span className="block" dir="auto">
									{bothNames(keyword)}
								</span>
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
