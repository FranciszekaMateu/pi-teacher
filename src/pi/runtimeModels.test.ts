import { describe, expect, it } from "vitest";
import { parsePiRuntimeModels, preferredPiRuntimeModel } from "./runtimeModels";

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
});
