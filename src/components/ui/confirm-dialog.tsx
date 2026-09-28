import type { ReactNode } from "react";
import { Button } from "./button";
import { Dialog } from "./dialog";

/** Asks before a destructive or irreversible action. */
export function ConfirmDialog({
	open,
	title,
	children,
	confirmLabel,
	busy = false,
	error,
	onConfirm,
	onClose,
}: {
	open: boolean;
	title: string;
	children: ReactNode;
	confirmLabel: string;
	busy?: boolean;
	error?: string;
	onConfirm: () => void;
	onClose: () => void;
}) {
	return (
		<Dialog
			open={open}
			onClose={onClose}
			title={title}
			size="sm"
			footer={
				<>
					<Button onClick={onClose} disabled={busy}>
						Cancel
					</Button>
					<Button variant="danger" loading={busy} onClick={onConfirm}>
						{confirmLabel}
					</Button>
				</>
			}
		>
			<div className="text-sm leading-relaxed text-muted">{children}</div>
			{error && (
				<p className="field-error mt-4" role="alert">
					{error}
				</p>
			)}
		</Dialog>
	);
}
