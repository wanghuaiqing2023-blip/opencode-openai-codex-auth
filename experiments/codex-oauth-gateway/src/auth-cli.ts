import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { startCallbackServer } from "./auth/callback-server.js";
import { openBrowser } from "./auth/browser.js";
import {
	createAuthorizationFlow,
	exchangeAuthorizationCode,
	getChatGptAccountId,
	getTokenFilePath,
	parseAuthorizationInput,
	saveTokens,
} from "./auth/oauth.js";

async function promptForCode(url: string, expectedState: string): Promise<string | null> {
	const rl = createInterface({ input, output });
	try {
		console.log("\nOpen this URL in your browser:");
		console.log(url);
		const value = await rl.question(
			"\nPaste the full redirect URL, or paste the authorization code: ",
		);
		const parsed = parseAuthorizationInput(value);
		if (!parsed.code) return null;
		if (parsed.state && parsed.state !== expectedState) {
			throw new Error("State mismatch in pasted authorization response.");
		}
		return parsed.code;
	} finally {
		rl.close();
	}
}

async function main(): Promise<void> {
	const flow = createAuthorizationFlow();
	let code: string | null = null;
	let callbackServer: Awaited<ReturnType<typeof startCallbackServer>> | null = null;

	try {
		callbackServer = await startCallbackServer(flow.state);
		console.log("Waiting for OAuth callback on http://localhost:1455/auth/callback");
		console.log("Opening browser for ChatGPT OAuth login...");
		openBrowser(flow.url);
		console.log("If the browser does not open, use this URL:");
		console.log(flow.url);
		code = await callbackServer.waitForCode();
	} catch (error) {
		console.warn(
			"Could not start local callback server on port 1455; falling back to manual paste.",
		);
		code = await promptForCode(flow.url, flow.state);
	} finally {
		callbackServer?.close();
	}

	if (!code) {
		throw new Error("No authorization code received.");
	}

	const tokens = await exchangeAuthorizationCode(code, flow.pkce.verifier);
	if (tokens.type !== "oauth") {
		throw new Error("Token exchange failed.");
	}

	const accountId = getChatGptAccountId(tokens.access);
	if (!accountId) {
		throw new Error("Could not extract ChatGPT account id from access token.");
	}

	await saveTokens(tokens);
	console.log("\nAuthentication complete.");
	console.log(`Token file: ${getTokenFilePath()}`);
	console.log(`ChatGPT account id: ${accountId}`);
}

main().catch((error) => {
	console.error("[codex-oauth-gateway] auth failed:", error);
	process.exitCode = 1;
});
