import { describe, expect, it } from "vitest";
import { parsePiRuntimeModels, preferredPiRuntimeModel, resolvedPiRuntimeModel } from "./runtimeModels";

describe("Pi runtime models", () => {
	it("keeps only usable provider/model pairs without exposing credentials", () => {
		const models = parsePiRuntimeModels([
			{ provider: "opencode", id: "kimi-k2.6", name: "Kimi K2.6", apiKey: "must-not-reach-ui" },
			{ provider: "openai-codex", id: "gpt-5.6-sol" },
			{ provider: "opencode", id: "kimi-k2.6" },
			{ provider: "broken" },
		]);
		expect(models).toEqual([
			{ provider: "openai-codex", id: "gpt-5.6-sol", name: "gpt-5.6-sol" },
			{ provider: "opencode", id: "kimi-k2.6", name: "Kimi K2.6" },
		]);
		expect(preferredPiRuntimeModel(models, "opencode", "kimi-k2.6")).toEqual(models[1]);
	});

	it("falls back to an authenticated model when the saved model is no longer available", () => {
		const models = parsePiRuntimeModels([
			{ provider: "openai-codex", id: "gpt-5.6-terra", name: "GPT-5.6 Terra" },
			{ provider: "opencode", id: "kimi-k2.6", name: "Kimi K2.6" },
		]);
		expect(resolvedPiRuntimeModel(models, "openai-codex", "retired-model")).toEqual(models[0]);
		expect(resolvedPiRuntimeModel(models, "missing-provider", "missing-model")).toEqual(models[0]);
	});
});
