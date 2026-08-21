import { describe, expect, it, vi } from "vitest";
import { withRpcTimeout } from "./rpcTimeout";

describe("withRpcTimeout", () => {
	it("rejects a stalled RPC handshake", async () => {
		vi.useFakeTimers();
		const pending = new Promise<void>(() => undefined);
		const result = withRpcTimeout(pending, 12000, "get_state");
		const assertion = expect(result).rejects.toThrow("Pi runtime timed out while waiting for get_state.");
		await vi.advanceTimersByTimeAsync(12000);
		await assertion;
		vi.useRealTimers();
	});
});
