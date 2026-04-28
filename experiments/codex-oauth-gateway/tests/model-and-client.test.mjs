import test from "node:test";
import assert from "node:assert/strict";
import { normalizeModel } from "../dist/codex/model.js";
import { callCodex } from "../dist/codex/client.js";
import { GatewayError } from "../dist/errors.js";

test("normalizeModel keeps GPT-5.1 codex mini compatibility mappings", () => {
	assert.equal(normalizeModel("gpt-5-codex-mini-high"), "gpt-5.1-codex-mini");
	assert.equal(normalizeModel("codex-mini-latest"), "gpt-5.1-codex-mini");
	assert.equal(normalizeModel("gpt-5-codex"), "gpt-5.1-codex");
});

test("callCodex rejects missing input with structured GatewayError", async () => {
	await assert.rejects(
		() => callCodex({ model: "gpt-5.1-codex" }, "fake_token", "fake_account"),
		(error) =>
			error instanceof GatewayError &&
			error.status === 400 &&
			error.code === "MISSING_INPUT",
	);
});
