export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

export interface ImageFileMetadata {
	name: string;
	type: string;
	size: number;
}

export function validateImageAttachment(file: ImageFileMetadata): { mimeType: string } {
	if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
		throw new Error("Only PNG, JPEG, WebP, or GIF images can be attached.");
	}
	if (file.size > MAX_IMAGE_BYTES) {
		throw new Error("Images must be 5 MiB or smaller.");
	}
	return { mimeType: file.type };
}
