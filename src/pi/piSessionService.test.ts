import { afterEach, describe, expect, it, vi } from "vitest";
import type { PiObsidianSettings } from "../settings";

vi.mock("obsidian", () => ({
	Modal: class Modal {},
	Notice: class Notice {},
	PluginSettingTab: class PluginSettingTab {},
	Setting: class Setting {},
	TFile: class TFile {},
	normalizePath: (path: string) => path,
}));

import { PiSessionService } from "./piSessionService";

type ServiceInternals = {
	child: { kill: ReturnType<typeof vi.fn> } | null;
	sendCommand: (type: string, extra?: Record<string, unknown>) => Promise<{ type: "response"; success: true }>;
	handleRpcMessage: (message: Record<string, unknown>) => void;
};

const SETTINGS = {
	provider: "openai-codex",
	modelId: "test-model",
	thinkingLevel: "medium",
} as PiObsidianSettings;

function createService(): PiSessionService {
	return new PiSessionService({
		app: { vault: { configDir: "config", adapter: { getBasePath: () => "C:\\vault" } } } as never,
		getSettings: () => SETTINGS,
		saveSettings: async () => undefined,
	});
}

function deferred(): { promise: Promise<void>; resolve: () => void } {
	let resolve = (): void => undefined;
	const promise = new Promise<void>((done) => { resolve = done; });
	return { promise, resolve };
}

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe("PiSessionService prompt lifecycle", () => {
	it("shows loading immediately and still dispatches after initialization", async () => {
		const service = createService();
		const initialization = deferred();
		vi.spyOn(service, "initialize").mockImplementation(() => initialization.promise);
		const sendCommand = vi.fn(async (_type: string, _extra?: Record<string, unknown>) => ({ type: "response" as const, success: true as const }));
		(service as unknown as ServiceInternals).sendCommand = sendCommand;

		const sending = service.sendPrompt("Explicame gradientes");
		expect(service.getSnapshot().isStreaming).toBe(true);
		expect(sendCommand).not.toHaveBeenCalled();

		initialization.resolve();
		await sending;
		const promptCall = sendCommand.mock.calls[0];
		expect(promptCall?.[0]).toBe("prompt");
		const sentMessage = promptCall?.[1]?.message;
		expect(typeof sentMessage).toBe("string");
		if (typeof sentMessage === "string") expect(sentMessage).toContain("Explicame gradientes");
		expect(service.getSnapshot().isStreaming).toBe(true);
		service.dispose();
	});

	it("cancels a prompt stopped while the runtime is initializing", async () => {
		const service = createService();
		const initialization = deferred();
		vi.spyOn(service, "initialize").mockImplementation(() => initialization.promise);
		const sendCommand = vi.fn(async () => ({ type: "response" as const, success: true as const }));
		(service as unknown as ServiceInternals).sendCommand = sendCommand;

		const sending = service.sendPrompt("No deberia enviarse");
		service.abort();
		expect(service.getSnapshot().isStreaming).toBe(false);

		initialization.resolve();
		await sending;
		expect(sendCommand).not.toHaveBeenCalled();
		service.dispose();
	});

	it("times out a prompt whose RPC preflight never acknowledges", async () => {
		vi.useFakeTimers();
		const service = createService();
		vi.spyOn(service, "initialize").mockResolvedValue();
		const kill = vi.fn();
		const promptResponse = deferred();
		const sendCommand = vi.fn((type: string) => type === "prompt"
			? promptResponse.promise.then(() => ({ type: "response" as const, success: true as const }))
			: Promise.resolve({ type: "response" as const, success: true as const }));
		const internals = service as unknown as ServiceInternals;
		internals.child = { kill };
		internals.sendCommand = sendCommand;

		const sending = service.sendPrompt("Quedaria esperando");
		await vi.advanceTimersByTimeAsync(3 * 60 * 1000);
		expect(kill).toHaveBeenCalledWith("SIGTERM");
		expect(sendCommand).not.toHaveBeenCalledWith("abort");
		expect(service.getSnapshot()).toMatchObject({
			isStreaming: false,
			errorMessage: "The model was stopped because it did not finish. Try a shorter note or lower the thinking effort.",
		});

		promptResponse.resolve();
		await sending;
		service.dispose();
	});

	it("aborts after the configured number of completed tool calls", async () => {
		const service = createService();
		vi.spyOn(service, "initialize").mockResolvedValue();
		const sendCommand = vi.fn(async () => ({ type: "response" as const, success: true as const }));
		const internals = service as unknown as ServiceInternals;
		internals.sendCommand = sendCommand;
		await service.sendPrompt("No entres en loop");
		vi.spyOn(console, "debug").mockImplementation(() => undefined);

		for (let index = 0; index < 32; index += 1) {
			internals.handleRpcMessage({ type: "tool_execution_end", toolCallId: `tool-${index}` });
		}
		await Promise.resolve();
		await Promise.resolve();
		await Promise.resolve();
		expect(sendCommand).toHaveBeenCalledWith("abort");
		expect(service.getSnapshot().errorMessage).toContain("too many tool calls");
		service.dispose();
	});

	it("restarts the runtime if an acknowledged abort does not settle", async () => {
		vi.useFakeTimers();
		const service = createService();
		vi.spyOn(service, "initialize").mockResolvedValue();
		const abortResponse = deferred();
		const kill = vi.fn();
		const sendCommand = vi.fn((type: string) => type === "abort"
			? abortResponse.promise.then(() => ({ type: "response" as const, success: true as const }))
			: Promise.resolve({ type: "response" as const, success: true as const }));
		const internals = service as unknown as ServiceInternals;
		internals.child = { kill };
		internals.sendCommand = sendCommand;
		await service.sendPrompt("Detener si queda colgado");

		service.abort();
		await vi.advanceTimersByTimeAsync(12_000);
		expect(kill).toHaveBeenCalledWith("SIGTERM");
		expect(service.getSnapshot()).toMatchObject({
			isStreaming: false,
			errorMessage: "Pi runtime timed out while waiting for abort.",
		});

		abortResponse.resolve();
		service.dispose();
	});
});
