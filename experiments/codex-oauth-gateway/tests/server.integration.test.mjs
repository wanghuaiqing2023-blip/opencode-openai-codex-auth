import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

function encodeBase64Url(value) {
	return Buffer.from(value).toString("base64url");
}

function createFakeAccessToken(accountId) {
	const header = encodeBase64Url(JSON.stringify({ alg: "none", typ: "JWT" }));
	const payload = encodeBase64Url(
		JSON.stringify({
			"https://api.openai.com/auth": { chatgpt_account_id: accountId },
		}),
	);
	return `${header}.${payload}.signature`;
}

async function waitForHealthy(baseUrl, timeoutMs = 10_000) {
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		try {
			const response = await fetch(`${baseUrl}/health`);
			if (response.ok) return;
		} catch {
			// Retry while server starts.
		}
		await new Promise((resolve) => setTimeout(resolve, 150));
	}
	throw new Error("Timed out waiting for gateway server to start.");
}

test("gateway HTTP integration: health + request validation errors", async (t) => {
	const tempRoot = await mkdtemp(join(tmpdir(), "codex-gateway-test-"));
	const tokenFile = join(tempRoot, ".tokens", "openai.json");
	await mkdir(join(tempRoot, ".tokens"), { recursive: true });

	await writeFile(
		tokenFile,
		JSON.stringify(
			{
				type: "oauth",
				access: createFakeAccessToken("acct_integration_test"),
				refresh: "refresh_token_for_test",
				expires: Date.now() + 60 * 60 * 1000,
			},
			null,
			2,
		),
		"utf8",
	);

	process.env.CODEX_GATEWAY_TOKEN_FILE = tokenFile;
	const { startGatewayServer } = await import("../dist/server.js");
	const port = 18787;
	const baseUrl = `http://127.0.0.1:${port}`;
	const server = startGatewayServer(port);

	t.after(() => {
		delete process.env.CODEX_GATEWAY_TOKEN_FILE;
		server.close();
	});

	await waitForHealthy(baseUrl);

	const healthResponse = await fetch(`${baseUrl}/health`);
	assert.equal(healthResponse.status, 200);
	const healthJson = await healthResponse.json();
	assert.equal(healthJson.ok, true);
	assert.equal(healthJson.authenticated, true);
	assert.equal(healthJson.tokenFile, tokenFile);

	const invalidJsonResponse = await fetch(`${baseUrl}/responses`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: '{"input":',
	});
	assert.equal(invalidJsonResponse.status, 400);
	const invalidJsonBody = await invalidJsonResponse.json();
	assert.equal(invalidJsonBody.code, "INVALID_JSON");

	const missingInputResponse = await fetch(`${baseUrl}/responses`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ model: "gpt-5.1-codex" }),
	});
	assert.equal(missingInputResponse.status, 400);
	const missingInputBody = await missingInputResponse.json();
	assert.equal(missingInputBody.code, "MISSING_INPUT");
});
