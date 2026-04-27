import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
	AUTHORIZE_URL,
	CLIENT_ID,
	JWT_CLAIM_PATH,
	REDIRECT_URI,
	SCOPE,
	TOKEN_URL,
} from "../constants.js";
import type {
	AuthorizationFlow,
	JWTPayload,
	ParsedAuthInput,
	PKCEPair,
	TokenResult,
	TokenSet,
} from "../types.js";

const TOKEN_FILE =
	process.env.CODEX_GATEWAY_TOKEN_FILE ?? resolve(".tokens", "openai.json");

function base64Url(bytes: Buffer): string {
	return bytes.toString("base64url");
}

export function getTokenFilePath(): string {
	return TOKEN_FILE;
}

export function createState(): string {
	return randomBytes(16).toString("hex");
}

export function createPKCEPair(): PKCEPair {
	const verifier = base64Url(randomBytes(32));
	const challenge = createHash("sha256").update(verifier).digest("base64url");
	return { verifier, challenge };
}

export function createAuthorizationFlow(): AuthorizationFlow {
	const pkce = createPKCEPair();
	const state = createState();
	const url = new URL(AUTHORIZE_URL);

	url.searchParams.set("response_type", "code");
	url.searchParams.set("client_id", CLIENT_ID);
	url.searchParams.set("redirect_uri", REDIRECT_URI);
	url.searchParams.set("scope", SCOPE);
	url.searchParams.set("code_challenge", pkce.challenge);
	url.searchParams.set("code_challenge_method", "S256");
	url.searchParams.set("state", state);
	url.searchParams.set("id_token_add_organizations", "true");
	url.searchParams.set("codex_cli_simplified_flow", "true");
	url.searchParams.set("originator", "codex_cli_rs");

	return { pkce, state, url: url.toString() };
}

export function parseAuthorizationInput(input: string): ParsedAuthInput {
	const value = input.trim();
	if (!value) return {};

	try {
		const url = new URL(value);
		return {
			code: url.searchParams.get("code") ?? undefined,
			state: url.searchParams.get("state") ?? undefined,
		};
	} catch {
		// Continue with non-URL parsing.
	}

	if (value.includes("#")) {
		const [code, state] = value.split("#", 2);
		return { code, state };
	}

	if (value.includes("code=")) {
		const params = new URLSearchParams(value);
		return {
			code: params.get("code") ?? undefined,
			state: params.get("state") ?? undefined,
		};
	}

	return { code: value };
}

async function parseTokenResponse(response: Response): Promise<TokenResult> {
	if (!response.ok) {
		const text = await response.text().catch(() => "");
		console.error("[codex-oauth-gateway] token request failed:", response.status, text);
		return { type: "failed" };
	}

	const json = (await response.json()) as {
		access_token?: string;
		refresh_token?: string;
		expires_in?: number;
	};

	if (
		!json.access_token ||
		!json.refresh_token ||
		typeof json.expires_in !== "number"
	) {
		console.error("[codex-oauth-gateway] token response missing fields:", json);
		return { type: "failed" };
	}

	return {
		type: "oauth",
		access: json.access_token,
		refresh: json.refresh_token,
		expires: Date.now() + json.expires_in * 1000,
	};
}

export async function exchangeAuthorizationCode(
	code: string,
	verifier: string,
): Promise<TokenResult> {
	const response = await fetch(TOKEN_URL, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			grant_type: "authorization_code",
			client_id: CLIENT_ID,
			code,
			code_verifier: verifier,
			redirect_uri: REDIRECT_URI,
		}),
	});

	return parseTokenResponse(response);
}

export async function refreshAccessToken(
	refreshToken: string,
): Promise<TokenResult> {
	const response = await fetch(TOKEN_URL, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			grant_type: "refresh_token",
			refresh_token: refreshToken,
			client_id: CLIENT_ID,
		}),
	});

	return parseTokenResponse(response);
}

export function decodeJWT(token: string): JWTPayload | null {
	try {
		const parts = token.split(".");
		if (parts.length !== 3) return null;
		return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
	} catch {
		return null;
	}
}

export function getChatGptAccountId(accessToken: string): string | null {
	const decoded = decodeJWT(accessToken);
	return decoded?.[JWT_CLAIM_PATH]?.chatgpt_account_id ?? null;
}

export async function saveTokens(tokens: TokenSet): Promise<void> {
	await mkdir(dirname(TOKEN_FILE), { recursive: true });
	await writeFile(TOKEN_FILE, `${JSON.stringify(tokens, null, 2)}\n`, {
		mode: 0o600,
	});
}

export async function loadTokens(): Promise<TokenSet | null> {
	try {
		const raw = await readFile(TOKEN_FILE, "utf8");
		const parsed = JSON.parse(raw) as Partial<TokenSet>;
		if (
			parsed.type !== "oauth" ||
			!parsed.access ||
			!parsed.refresh ||
			typeof parsed.expires !== "number"
		) {
			return null;
		}
		return parsed as TokenSet;
	} catch {
		return null;
	}
}

export async function getValidTokens(): Promise<TokenSet> {
	const tokens = await loadTokens();
	if (!tokens) {
		throw new Error(
			`No OAuth tokens found. Run "npm run build && npm run auth" first. Expected token file: ${TOKEN_FILE}`,
		);
	}

	const refreshSkewMs = 60_000;
	if (tokens.expires > Date.now() + refreshSkewMs) {
		return tokens;
	}

	const refreshed = await refreshAccessToken(tokens.refresh);
	if (refreshed.type !== "oauth") {
		throw new Error("OAuth token refresh failed. Re-run npm run auth.");
	}

	await saveTokens(refreshed);
	return refreshed;
}
