export const CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
export const AUTHORIZE_URL = "https://auth.openai.com/oauth/authorize";
export const TOKEN_URL = "https://auth.openai.com/oauth/token";
export const REDIRECT_URI = "http://localhost:1455/auth/callback";
export const SCOPE = "openid profile email offline_access";

export const CODEX_RESPONSES_URL =
	"https://chatgpt.com/backend-api/codex/responses";

export const JWT_CLAIM_PATH = "https://api.openai.com/auth";

export const OPENAI_HEADERS = {
	BETA: "OpenAI-Beta",
	ACCOUNT_ID: "chatgpt-account-id",
	ORIGINATOR: "originator",
	SESSION_ID: "session_id",
	CONVERSATION_ID: "conversation_id",
} as const;

export const OPENAI_HEADER_VALUES = {
	BETA_RESPONSES: "responses=experimental",
	ORIGINATOR_CODEX: "codex_cli_rs",
} as const;

export const DEFAULT_INSTRUCTIONS =
	"You are a helpful coding assistant. Answer clearly and directly.";

export const DEFAULT_GATEWAY_PORT = 8787;
export const DEFAULT_UPSTREAM_TIMEOUT_MS = 60_000;
