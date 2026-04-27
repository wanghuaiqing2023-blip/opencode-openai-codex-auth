import http from "node:http";
import { DEFAULT_GATEWAY_PORT } from "./constants.js";
import {
	getChatGptAccountId,
	getTokenFilePath,
	getValidTokens,
	loadTokens,
} from "./auth/oauth.js";
import { callCodex } from "./codex/client.js";
import type { GatewayRequestBody } from "./types.js";

async function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
	let body = "";
	for await (const chunk of req) {
		body += chunk;
		if (body.length > 20 * 1024 * 1024) {
			throw new Error("Request body too large.");
		}
	}
	return body ? JSON.parse(body) : {};
}

function sendJson(
	res: http.ServerResponse,
	status: number,
	payload: unknown,
): void {
	res.statusCode = status;
	res.setHeader("content-type", "application/json; charset=utf-8");
	res.end(JSON.stringify(payload, null, 2));
}

async function handleResponses(
	req: http.IncomingMessage,
	res: http.ServerResponse,
): Promise<void> {
	const body = (await readJsonBody(req)) as GatewayRequestBody;
	const tokens = await getValidTokens();
	const accountId = getChatGptAccountId(tokens.access);
	if (!accountId) {
		throw new Error("Could not extract ChatGPT account id from access token.");
	}

	const upstream = await callCodex(body, tokens.access, accountId);
	res.statusCode = upstream.status;
	res.statusMessage = upstream.statusText;
	upstream.headers.forEach((value, key) => res.setHeader(key, value));

	if (!upstream.body) {
		res.end();
		return;
	}

	const reader = upstream.body.getReader();
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		res.write(Buffer.from(value));
	}
	res.end();
}

async function handleHealth(res: http.ServerResponse): Promise<void> {
	const tokens = await loadTokens();
	sendJson(res, 200, {
		ok: true,
		authenticated: !!tokens,
		tokenFile: getTokenFilePath(),
		expires: tokens?.expires ?? null,
	});
}

const port = Number(process.env.CODEX_GATEWAY_PORT ?? DEFAULT_GATEWAY_PORT);

const server = http.createServer((req, res) => {
	void (async () => {
		const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
		if (req.method === "GET" && url.pathname === "/health") {
			await handleHealth(res);
			return;
		}

		if (req.method === "POST" && url.pathname === "/responses") {
			await handleResponses(req, res);
			return;
		}

		sendJson(res, 404, {
			error: "Not found",
			routes: ["GET /health", "POST /responses"],
		});
	})().catch((error) => {
		sendJson(res, 500, {
			error: error instanceof Error ? error.message : String(error),
		});
	});
});

server.listen(port, "127.0.0.1", () => {
	console.log(`codex-oauth-gateway listening on http://127.0.0.1:${port}`);
	console.log("Run npm run auth first if /health says authenticated=false.");
});
