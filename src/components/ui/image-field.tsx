import { ImagePlus } from "lucide-react";
import { useState } from "react";
import { axiosInstance, errorMessage } from "@/api/axios-instance";
import type { PostFilesUpload200 } from "@/api/generated/schemas";
import { useAuth } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { Button } from "./button";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export type PickedImage = { id: string; url: string };

async function uploadImage(file: File): Promise<PostFilesUpload200> {
	const body = new FormData();
	body.append("file", file);
	const { data } = await axiosInstance.post<PostFilesUpload200>(
		"/api/admin/files/upload",
		body,
	);
	return data;
}

/**
 * Image preview with upload, replace and remove. Uploads right away and
 * reports the stored file; `onUploadingChange` lets the form wait for it.
 */
export function ImageField({
	label,
	value,
	onChange,
	onUploadingChange,
	hint,
}: {
	label: string;
	value: PickedImage | null;
	onChange: (image: PickedImage | null) => void;
	onUploadingChange?: (uploading: boolean) => void;
	hint?: string;
}) {
	const { can } = useAuth();
	const [uploading, setUploading] = useState(false);
	const [error, setError] = useState("");

	const setBusy = (busy: boolean) => {
		setUploading(busy);
		onUploadingChange?.(busy);
	};

	const pick = async (file: File | undefined) => {
		if (!file) return;
		if (!file.type.startsWith("image/"))
			return setError("Choose an image file.");
		if (file.size > MAX_IMAGE_BYTES)
			return setError("Images must be 8 MB or smaller.");
		setError("");
		setBusy(true);
		try {
			const uploaded = await uploadImage(file);
			onChange({ id: uploaded.id, url: uploaded.url });
		} catch (reason) {
			setError(errorMessage(reason, "The image could not be uploaded."));
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="flex items-start gap-4">
			<div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-wash">
				{value ? (
					<img src={value.url} alt={label} className="size-full object-cover" />
				) : (
					<ImagePlus
						size={22}
						strokeWidth={1.75}
						className="text-muted"
						aria-hidden
					/>
				)}
			</div>
			<div className="space-y-2 text-sm">
				<p className="font-semibold">{label}</p>
				{can(PERMISSIONS.novels.upload) ? (
					<div className="flex flex-wrap gap-2">
						<label
							className={`btn btn-secondary ${uploading ? "pointer-events-none opacity-60" : ""}`}
						>
							<span>
								{uploading ? "Uploading…" : value ? "Replace" : "Upload"}
							</span>
							<input
								type="file"
								accept="image/*"
								className="sr-only"
								disabled={uploading}
								onChange={(event) => void pick(event.target.files?.[0])}
							/>
						</label>
						{value && (
							<Button variant="ghost" onClick={() => onChange(null)}>
								Remove
							</Button>
						)}
					</div>
				) : (
					<p className="text-muted">Your role can’t upload images.</p>
				)}
				{hint && <p className="field-hint">{hint}</p>}
				{error && (
					<p className="field-error" role="alert">
						{error}
					</p>
				)}
			</div>
		</div>
	);
}
