import type { PiRuntimeModel } from "./rpcState";

type UnknownModel = { provider?: unknown; id?: unknown; name?: unknown };

/** Keeps only the model data required by the UI; provider auth stays in Pi. */
export function parsePiRuntimeModels(value: unknown): PiRuntimeModel[] {
	if (!Array.isArray(value)) return [];
	const seen = new Set<string>();
	const models: PiRuntimeModel[] = [];
	for (const candidate of value as UnknownModel[]) {
		if (typeof candidate.provider !== "string" || typeof candidate.id !== "string") continue;
		const provider = candidate.provider.trim();
		const id = candidate.id.trim();
		if (!provider || !id || seen.has(`${provider}\u0000${id}`)) continue;
		seen.add(`${provider}\u0000${id}`);
		models.push({ provider, id, name: typeof candidate.name === "string" && candidate.name.trim() ? candidate.name : id });
	}
	return models.sort((a, b) => a.provider.localeCompare(b.provider) || a.name.localeCompare(b.name));
}

/** Only restore a saved selection when it is authenticated in Pi right now. */
export function preferredPiRuntimeModel(models: readonly PiRuntimeModel[], provider: string, modelId: string): PiRuntimeModel | undefined {
	return models.find((model) => model.provider === provider && model.id === modelId);
}
