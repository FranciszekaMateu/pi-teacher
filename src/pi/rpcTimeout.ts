export function withRpcTimeout<T>(promise: Promise<T>, timeoutMs: number, command: string): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		const onTimeout = (): void => {
			reject(new Error(`Pi runtime timed out while waiting for ${command}.`));
		};
		const timer = typeof window !== "undefined" ? window.setTimeout(onTimeout, timeoutMs) : setTimeout(onTimeout, timeoutMs);
		const cancelTimer = (): void => {
			if (typeof window !== "undefined") window.clearTimeout(timer);
			else clearTimeout(timer);
		};
		void promise.then(
			(value) => {
				cancelTimer();
				resolve(value);
			},
			(error: unknown) => {
				cancelTimer();
				reject(error instanceof Error ? error : new Error(String(error)));
			},
		);
	});
}
