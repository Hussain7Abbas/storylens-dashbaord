import { LoaderCircle } from "lucide-react";

export function Spinner({
	size = 16,
	label,
}: {
	size?: number;
	label?: string;
}) {
	return (
		<LoaderCircle
			size={size}
			strokeWidth={1.75}
			className="animate-spin motion-reduce:animate-none"
			aria-hidden={label ? undefined : true}
			aria-label={label}
			role={label ? "status" : undefined}
		/>
	);
}
