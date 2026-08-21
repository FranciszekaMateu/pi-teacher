export function withRpcTimeout<T>(promise: Promise<T>, timeoutMs: number, command: string): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		const timer = globalThis.setTimeout(() => {
			reject(new Error(`Pi runtime timed out while waiting for ${command}.`));
		}, timeoutMs);
		void promise.then(
			(value) => {
				globalThis.clearTimeout(timer);
				resolve(value);
			},
			(error: unknown) => {
				globalThis.clearTimeout(timer);
				reject(error instanceof Error ? error : new Error(String(error)));
			},
		);
	});
}
