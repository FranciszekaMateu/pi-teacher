export function firstPastedImage(files: FileList): File | undefined {
	return Array.from(files).find((file) => file.type.startsWith("image/"));
}
