export interface PdfRequest {
	path: string;
	pageStart: number;
	pageEnd: number;
}

export const MAX_PDF_PAGES_PER_READ = 25;

export function validatePdfRequest(
	path: string,
	pageStart: number | undefined,
	pageEnd: number | undefined,
	totalPages: number,
): PdfRequest {
	const normalized = path.replace(/\\/g, "/").replace(/^\.\//, "");
	if (!normalized || normalized.startsWith("/") || /^[A-Za-z]:\//.test(normalized) || normalized.split("/").includes("..")) {
		throw new Error("PDF path must be vault-relative and must not escape the vault.");
	}
	if (!normalized.toLowerCase().endsWith(".pdf")) {
		throw new Error("read_pdf only accepts paths ending in .pdf.");
	}
	if (!Number.isInteger(totalPages) || totalPages < 1) {
		throw new Error("PDF has no readable pages.");
	}

	const start = pageStart ?? 1;
	const end = pageEnd ?? totalPages;
	if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start || end > totalPages) {
		throw new Error(`Invalid PDF page range: ${start}-${end} for a ${totalPages}-page document.`);
	}
	if (end - start + 1 > MAX_PDF_PAGES_PER_READ) {
		throw new Error(`read_pdf can read at most ${MAX_PDF_PAGES_PER_READ} pages per call.`);
	}
	return { path: normalized, pageStart: start, pageEnd: end };
}
