export type Exists = (path: string) => boolean;

/** Resolve Node without relying on the PATH inherited by a GUI-launched app. */
export function resolveNodeExecutable(configuredPath: string | undefined, platform: NodeJS.Platform, exists: Exists): string {
	const configured = configuredPath?.trim();
	if (configured) return configured;
	if (platform === "win32") {
		const standardInstall = "C:\\Program Files\\nodejs\\node.exe";
		if (exists(standardInstall)) return standardInstall;
	}
	return "node";
}
