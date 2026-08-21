/**
 * Node-only entrypoint bundled as pi-runtime.cjs.
 *
 * Register OAuth flows before loading Pi's RPC entrypoint. Its default loader
 * otherwise tries a relative dynamic import next to this bundle.
 */
import { registerBunOAuthFlows } from "@earendil-works/pi-ai/bun-oauth";

registerBunOAuthFlows();
void import("@earendil-works/pi-coding-agent/rpc-entry").catch((error: unknown) => {
	console.error("Pi runtime startup failed", error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
