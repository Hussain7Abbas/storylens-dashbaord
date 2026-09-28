import { Search } from "lucide-react";
import { useEffect, useState } from "react";

/** Search box that reports its value after typing pauses. */
export function SearchInput({
	value,
	onChange,
	label,
	placeholder,
}: {
	value: string;
	onChange: (value: string) => void;
	label: string;
	placeholder?: string;
}) {
	const [text, setText] = useState(value);

	useEffect(() => setText(value), [value]);

	useEffect(() => {
		if (text === value) return;
		const timer = window.setTimeout(() => onChange(text.trim()), 300);
		return () => window.clearTimeout(timer);
	}, [text, value, onChange]);

	return (
		<div className="relative w-full sm:max-w-xs">
			<Search
				size={16}
				strokeWidth={1.75}
				aria-hidden
				className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
			/>
			<input
				type="search"
				className="input pl-9"
				aria-label={label}
				placeholder={placeholder ?? label}
				value={text}
				onChange={(event) => setText(event.target.value)}
			/>
		</div>
	);
}
