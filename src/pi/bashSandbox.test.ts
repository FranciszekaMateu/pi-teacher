import { describe, expect, it, vi } from "vitest";
import { createBashSandboxOperations } from "./bashSandbox";

describe("createBashSandboxOperations", () => {
	it("rejects shell operators before spawning a process", async () => {
		const onData = vi.fn();
		const operations = createBashSandboxOperations({ allowlist: ["rg"], timeoutMs: 1000, cwd: "." });

		const result = await operations.exec("rg notes .; echo escaped", ".", { onData });

		expect(result.exitCode).toBe(1);
		expect(onData).toHaveBeenCalledWith(Buffer.from("bash: shell operators and control characters are not allowed\n"));
	});

	it("rejects an executable outside the allowlist", async () => {
		const onData = vi.fn();
		const operations = createBashSandboxOperations({ allowlist: ["rg"], timeoutMs: 1000, cwd: "." });

		const result = await operations.exec("cat notes.md", ".", { onData });

		expect(result.exitCode).toBe(1);
		expect(onData).toHaveBeenCalledWith(Buffer.from("bash: cat: command not allowed (allowlist)\n"));
	});
});
