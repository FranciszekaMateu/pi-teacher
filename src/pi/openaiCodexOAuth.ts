/**
 * OpenAI Codex (ChatGPT subscription) OAuth login — device-code flow.
 *
 * Uses Obsidian's `requestUrl` so the requests go through the plugin's
 * Node-side HTTP client (no CORS, no Electron renderer fetch issues).
 */

import { requestUrl } from "obsidian";

const CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
const AUTH_BASE_URL = "https://auth.openai.com";
const TOKEN_URL = `${AUTH_BASE_URL}/oauth/token`;
const DEVICE_USER_CODE_URL = `${AUTH_BASE_URL}/api/accounts/deviceauth/usercode`;
const DEVICE_TOKEN_URL = `${AUTH_BASE_URL}/api/accounts/deviceauth/token`;
const DEVICE_VERIFICATION_URI = `${AUTH_BASE_URL}/codex/device`;
const DEVICE_REDIRECT_URI = `${AUTH_BASE_URL}/deviceauth/callback`;
const DEVICE_CODE_TIMEOUT_SECONDS = 15 * 60;

export interface OpenAICodexCredentials {
	access: string;
	refresh: string;
	expires: number;
	accountId?: string;
}

export interface DeviceAuthInfo {
	deviceAuthId: string;
	userCode: string;
	intervalSeconds: number;
	verificationUri: string;
}

type PollResult =
	| { status: "pending" }
	| { status: "slow_down"; intervalSeconds?: number }
	| { status: "failed"; message: string }
	| { status: "complete"; value: { authorizationCode: string; codeVerifier: string } };

export class CodexAuthError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "CodexAuthError";
	}
}

async function postObsidian(
	url: string,
	body: string,
	contentType: "application/json" | "application/x-www-form-urlencoded",
	signal?: AbortSignal,
): Promise<{ status: number; text: string; json: () => Promise<unknown> }> {
	const response = await requestUrl({
		url,
		method: "POST",
		headers: {
			"Content-Type": contentType,
			Accept: "application/json",
		},
		body,
		throw: false,
	});
	if (signal?.aborted) {
		throw new Error("Login cancelled");
	}
	return {
		status: response.status,
		text: response.text,
		json: async () => {
			try {
				return JSON.parse(response.text) as unknown;
			} catch {
				return null;
			}
		},
	};
}

export async function startCodexDeviceAuth(signal?: AbortSignal): Promise<DeviceAuthInfo> {
	let response: { status: number; text: string; json: () => Promise<unknown> };
	try {
		response = await postObsidian(
			DEVICE_USER_CODE_URL,
			JSON.stringify({ client_id: CLIENT_ID }),
			"application/json",
			signal,
		);
	} catch (error) {
		if (signal?.aborted) throw new Error("Login cancelled");
		throw new CodexAuthError(
			`Could not reach OpenAI to start login: ${error instanceof Error ? error.message : String(error)}`,
		);
	}

	if (response.status !== 200) {
		throw new CodexAuthError(
			`OpenAI device code request failed (${response.status})${response.text ? `: ${response.text}` : ""}`,
		);
	}

	const json = (await response.json()) as {
		device_auth_id?: string;
		user_code?: string;
		interval?: number | string;
	} | null;

	const intervalSeconds = typeof json?.interval === "string" ? Number(json.interval.trim()) : json?.interval;
	if (
		!json?.device_auth_id ||
		!json.user_code ||
		typeof intervalSeconds !== "number" ||
		!Number.isFinite(intervalSeconds) ||
		intervalSeconds < 0
	) {
		throw new CodexAuthError(`Invalid OpenAI device code response: ${JSON.stringify(json)}`);
	}

	return {
		deviceAuthId: json.device_auth_id,
		userCode: json.user_code,
		intervalSeconds,
		verificationUri: DEVICE_VERIFICATION_URI,
	};
}

export async function pollCodexDeviceAuth(
	device: DeviceAuthInfo,
	callbacks: { onTick?: (message: string) => void },
	signal?: AbortSignal,
): Promise<{ authorizationCode: string; codeVerifier: string }> {
	const deadline = Date.now() + DEVICE_CODE_TIMEOUT_SECONDS * 1000;
	let intervalMs = Math.max(1_000, Math.floor(device.intervalSeconds * 1_000));

	while (true) {
		if (signal?.aborted) throw new Error("Login cancelled");
		const remaining = deadline - Date.now();
		if (remaining <= 0) throw new CodexAuthError("Device flow timed out");

		let result: PollResult;
		try {
			result = await performDevicePoll(device, signal);
		} catch (error) {
			if (signal?.aborted) throw new Error("Login cancelled");
			throw new CodexAuthError(
				`Could not poll OpenAI: ${error instanceof Error ? error.message : String(error)}`,
			);
		}

		if (result.status === "complete") return result.value;
		if (result.status === "failed") throw new CodexAuthError(result.message);
		if (result.status === "slow_down") {
			intervalMs = Math.min(intervalMs + 5_000, Math.max(intervalMs, 10_000));
		}

		callbacks.onTick?.(`Waiting for authorization… (${Math.max(1, Math.round(remaining / 1000))}s left)`);
		await abortableSleep(Math.min(intervalMs, remaining), signal);
	}
}

async function performDevicePoll(device: DeviceAuthInfo, signal?: AbortSignal): Promise<PollResult> {
	const response = await postObsidian(
		DEVICE_TOKEN_URL,
		JSON.stringify({ device_auth_id: device.deviceAuthId, user_code: device.userCode }),
		"application/json",
		signal,
	);

	if (response.status === 200) {
		const json = (await response.json()) as { authorization_code?: string; code_verifier?: string } | null;
		if (!json?.authorization_code || !json.code_verifier) {
			return { status: "failed", message: `Invalid device auth token response: ${JSON.stringify(json)}` };
		}
		return {
			status: "complete",
			value: { authorizationCode: json.authorization_code, codeVerifier: json.code_verifier },
		};
	}

	if (response.status === 403 || response.status === 404) {
		return { status: "pending" };
	}

	const body = response.text;
	let errorCode: unknown;
	try {
		const json = JSON.parse(body) as { error?: string | { code?: string } } | null;
		const error = json?.error;
		errorCode = typeof error === "object" ? error?.code : error;
	} catch {
		// not json
	}

	if (errorCode === "deviceauth_authorization_pending") return { status: "pending" };
	if (errorCode === "slow_down") return { status: "slow_down" };
	return { status: "failed", message: `Device auth failed (${response.status})${body ? `: ${body}` : ""}` };
}

function decodeJwt(token: string): { chatgpt_account_id?: string } | null {
	try {
		const parts = token.split(".");
		if (parts.length !== 3) return null;
		const payload = parts[1] ?? "";
		const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
		const decoded = decodeURIComponent(
			Array.from(atob(normalized), (c) => `%${c.charCodeAt(0).toString(16).padStart(2, "0")}`).join(""),
		);
		const json = JSON.parse(decoded) as { "https://api.openai.com/auth"?: { chatgpt_account_id?: string } };
		return json["https://api.openai.com/auth"] ?? null;
	} catch {
		return null;
	}
}

async function readTokenResponse(body: string, operation: "exchange" | "refresh"): Promise<OpenAICodexCredentials> {
	const json = (() => {
		try {
			return JSON.parse(body) as {
				access_token?: string;
				refresh_token?: string;
				expires_in?: number;
			} | null;
		} catch {
			return null;
		}
	})();

	if (!json?.access_token || !json.refresh_token || typeof json.expires_in !== "number") {
		throw new CodexAuthError(`Token ${operation} response missing fields: ${body}`);
	}

	return {
		access: json.access_token,
		refresh: json.refresh_token,
		expires: Date.now() + json.expires_in * 1000,
		accountId: decodeJwt(json.access_token)?.chatgpt_account_id,
	};
}

export async function exchangeCodexCode(code: string, verifier: string, signal?: AbortSignal): Promise<OpenAICodexCredentials> {
	const response = await postObsidian(
		TOKEN_URL,
		new URLSearchParams({
			grant_type: "authorization_code",
			client_id: CLIENT_ID,
			code,
			code_verifier: verifier,
			redirect_uri: DEVICE_REDIRECT_URI,
		}).toString(),
		"application/x-www-form-urlencoded",
		signal,
	);
	if (response.status !== 200) {
		throw new CodexAuthError(
			`OpenAI Codex token exchange failed (${response.status})${response.text ? `: ${response.text}` : ""}`,
		);
	}
	return readTokenResponse(response.text, "exchange");
}

export async function refreshCodexToken(refreshToken: string, signal?: AbortSignal): Promise<OpenAICodexCredentials> {
	const response = await postObsidian(
		TOKEN_URL,
		new URLSearchParams({
			grant_type: "refresh_token",
			refresh_token: refreshToken,
			client_id: CLIENT_ID,
		}).toString(),
		"application/x-www-form-urlencoded",
		signal,
	);
	if (response.status !== 200) {
		throw new CodexAuthError(
			`OpenAI Codex token refresh failed (${response.status})${response.text ? `: ${response.text}` : ""}`,
		);
	}
	return readTokenResponse(response.text, "refresh");
}

export async function loginCodexWithDeviceCode(
	callbacks: {
		onUserCode: (device: DeviceAuthInfo) => void;
		onTick?: (message: string) => void;
	},
	signal?: AbortSignal,
): Promise<OpenAICodexCredentials> {
	const device = await startCodexDeviceAuth(signal);
	callbacks.onUserCode(device);
	const { authorizationCode, codeVerifier } = await pollCodexDeviceAuth(device, callbacks, signal);
	return exchangeCodexCode(authorizationCode, codeVerifier, signal);
}

function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		if (signal?.aborted) {
			reject(new Error("Login cancelled"));
			return;
		}
		const onAbort = () => {
			clearTimeout(timeout);
			reject(new Error("Login cancelled"));
		};
		const timeout = setTimeout(() => {
			signal?.removeEventListener("abort", onAbort);
			resolve();
		}, ms);
		signal?.addEventListener("abort", onAbort, { once: true });
	});
}

export const CODEX_OAUTH = {
	clientId: CLIENT_ID,
	verificationUri: DEVICE_VERIFICATION_URI,
};
