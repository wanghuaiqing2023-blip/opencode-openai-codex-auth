import test from "node:test";
import assert from "node:assert/strict";
import {
	convertSseToJson,
	handleErrorResponse,
	wantsStream,
} from "../dist/codex/response.js";

test("wantsStream only returns true when stream=true", () => {
	assert.equal(wantsStream({ stream: true }), true);
	assert.equal(wantsStream({ stream: false }), false);
	assert.equal(wantsStream({}), false);
});

test("convertSseToJson extracts final response from SSE", async () => {
	const ssePayload = [
		'data: {"type":"response.output_text.delta","delta":"Hi"}',
		'data: {"type":"response.done","response":{"id":"resp_1","output_text":"Hi"}}',
		"",
	].join("\n");
	const response = new Response(ssePayload, {
		status: 200,
		headers: { "content-type": "text/event-stream" },
	});

	const converted = await convertSseToJson(response);
	assert.equal(converted.status, 200);
	assert.match(
		converted.headers.get("content-type") ?? "",
		/application\/json/,
	);
	assert.deepEqual(await converted.json(), { id: "resp_1", output_text: "Hi" });
});

test("convertSseToJson falls back to original SSE body when final event is missing", async () => {
	const ssePayload = 'data: {"type":"response.output_text.delta","delta":"partial"}\n';
	const response = new Response(ssePayload, {
		status: 200,
		headers: { "content-type": "text/event-stream" },
	});

	const converted = await convertSseToJson(response);
	assert.equal(converted.status, 200);
	assert.match(
		converted.headers.get("content-type") ?? "",
		/text\/event-stream/,
	);
	assert.equal(await converted.text(), ssePayload);
});

test("handleErrorResponse maps usage_limit_exceeded from 404 to 429", async () => {
	const response = new Response(
		JSON.stringify({ error: { code: "usage_limit_exceeded" } }),
		{
			status: 404,
			headers: { "content-type": "application/json" },
		},
	);

	const mapped = await handleErrorResponse(response);
	assert.equal(mapped.status, 429);
	assert.equal(mapped.statusText, "Too Many Requests");
});
