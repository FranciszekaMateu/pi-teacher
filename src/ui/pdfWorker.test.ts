import { describe, expect, it, vi } from "vitest";
import { configurePdfWorker } from "./pdfWorker";

describe("configurePdfWorker", () => {
	it("uses the build-embedded worker source without network loading", () => {
		const worker = {} as Worker;
		const globalScope = { pdfjs: { GlobalWorkerOptions: {} } } as { pdfjs?: { GlobalWorkerOptions?: { workerPort?: Worker } } };
		const createWorker = vi.fn(() => worker);
		configurePdfWorker({ globalScope, source: "self.onmessage = () => {};", createWorker });
		expect(createWorker).toHaveBeenCalledWith("self.onmessage = () => {};");
		expect(globalScope.pdfjs?.GlobalWorkerOptions?.workerPort).toBe(worker);
	});
});
