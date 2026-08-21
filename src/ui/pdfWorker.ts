declare const __PDF_WORKER_SOURCE__: string;

type PdfjsGlobal = { pdfjs?: { GlobalWorkerOptions?: { workerPort?: Worker } } };

export function configurePdfWorker(options: {
	globalScope: PdfjsGlobal;
	source: string;
	createWorker: (source: string) => Worker;
}): void {
	const workerOptions = options.globalScope.pdfjs?.GlobalWorkerOptions;
	if (!workerOptions) throw new Error("PDF.js worker configuration is unavailable.");
	if (!workerOptions.workerPort) workerOptions.workerPort = options.createWorker(options.source);
}

export function configurePdfWorkerForObsidian(): void {
	configurePdfWorker({
		globalScope: globalThis as PdfjsGlobal,
		source: __PDF_WORKER_SOURCE__,
		createWorker: (source) => {
			const url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
			return new Worker(url, { type: "module" });
		},
	});
}
