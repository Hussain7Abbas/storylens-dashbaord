import { cloneElement, type ReactElement, useId } from "react";

type ControlProps = {
	id?: string;
	"aria-invalid"?: boolean;
	"aria-describedby"?: string;
};

/** Visible label, optional hint and an inline error tied to one control. */
export function Field({
	label,
	hint,
	error,
	children,
	className = "",
}: {
	label: string;
	hint?: string;
	error?: string;
	children: ReactElement<ControlProps>;
	className?: string;
}) {
	const id = useId();
	const hintId = hint ? `${id}-hint` : undefined;
	const errorId = error ? `${id}-error` : undefined;
	const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

	return (
		<div className={className}>
			<label className="field-label" htmlFor={id}>
				{label}
			</label>
			{cloneElement(children, {
				id,
				"aria-invalid": error ? true : undefined,
				"aria-describedby": describedBy,
			})}
			{hint && (
				<p id={hintId} className="field-hint">
					{hint}
				</p>
			)}
			{error && (
				<p id={errorId} className="field-error">
					{error}
				</p>
			)}
		</div>
	);
}
