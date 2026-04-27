export interface PKCEPair {
	verifier: string;
	challenge: string;
}

export interface AuthorizationFlow {
	pkce: PKCEPair;
	state: string;
	url: string;
}

export interface TokenSet {
	type: "oauth";
	access: string;
	refresh: string;
	expires: number;
}

export type TokenResult = TokenSet | { type: "failed" };

export interface ParsedAuthInput {
	code?: string;
	state?: string;
}

export interface JWTPayload {
	"https://api.openai.com/auth"?: {
		chatgpt_account_id?: string;
	};
	[key: string]: unknown;
}

export interface GatewayRequestBody {
	model?: string;
	input?: unknown;
	stream?: boolean;
	instructions?: string;
	reasoning?: {
		effort?: "none" | "minimal" | "low" | "medium" | "high" | "xhigh";
		summary?: "auto" | "concise" | "detailed" | "off" | "on";
	};
	text?: {
		verbosity?: "low" | "medium" | "high";
	};
	include?: string[];
	prompt_cache_key?: string;
	[key: string]: unknown;
}
