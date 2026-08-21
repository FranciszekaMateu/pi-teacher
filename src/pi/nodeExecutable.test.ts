import { describe, expect, it } from "vitest";
import { resolveNodeExecutable } from "./nodeExecutable";

describe("resolveNodeExecutable", () => {
	it("uses an explicitly configured Node path first", () => {
		expect(resolveNodeExecutable("D:\\custom\\node.exe", "win32", () => true)).toBe("D:\\custom\\node.exe");
	});

	it("uses the standard Windows installation when PATH is unavailable", () => {
		expect(resolveNodeExecutable(undefined, "win32", (path) => path === "C:\\Program Files\\nodejs\\node.exe"))
			.toBe("C:\\Program Files\\nodejs\\node.exe");
	});

	it("falls back to node on PATH when no known executable exists", () => {
		expect(resolveNodeExecutable(undefined, "linux", () => false)).toBe("node");
	});
});
