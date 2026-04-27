import {
	CODEX_RESPONSES_URL,
	DEFAULT_INSTRUCTIONS,
	OPENAI_HEADER_VALUES,
	OPENAI_HEADERS,
} from "../constants.js";
import type { GatewayRequestBody } from "../types.js";
import { normalizeModel } from "./model.js";
import { convertSseToJson, wantsStream } from "./response.js";

function ensureInclude(include: string[] | undefined): string[] {
	const merged = new Set(include ?? []);
	merged.add("reasoning.encrypted_content");
	return Array.from(merged);
}

function transformBody(input: GatewayRequestBody): GatewayRequestBody {
	if (!input.input) {
		throw new Error("Request body must include an input field.");
	}

	return {
		...input,
		model: normalizeModel(input.model),
		store: false,
		stream: true,
		instructions: input.instructions ?? DEFAULT_INSTRUCTIONS,
		reasoning: {
			effort: input.reasoning?.effort ?? "medium",
			summary: input.reasoning?.summary ?? "auto",
		},
		text: {
			verbosity: input.text?.verbosity ?? "medium",
		},
		include: ensureInclude(input.include),
	};
}

function createHeaders(
	accessToken: string,
	accountId: string,
	promptCacheKey?: string,
): Headers {
	const headers = new Headers();
	headers.set("Authorization", `Bearer ${accessToken}`);
	headers.set(OPENAI_HEADERS.ACCOUNT_ID, accountId);
	headers.set(OPENAI_HEADERS.BETA, OPENAI_HEADER_VALUES.BETA_RESPONSES);
	headers.set(OPENAI_HEADERS.ORIGINATOR, OPENAI_HEADER_VALUES.ORIGINATOR_CODEX);
	headers.set("accept", "text/event-stream");
	headers.set("content-type", "application/json");

	if (promptCacheKey) {
		headers.set(OPENAI_HEADERS.CONVERSATION_ID, promptCacheKey);
		headers.set(OPENAI_HEADERS.SESSION_ID, promptCacheKey);
	}

	return headers;
}

export async function callCodex(
	body: GatewayRequestBody,
	accessToken: string,
	accountId: string,
): Promise<Response> {
	const transformedBody = transformBody(body);
	const response = await fetch(CODEX_RESPONSES_URL, {
		method: "POST",
		headers: createHeaders(
			accessToken,
			accountId,
			transformedBody.prompt_cache_key,
		),
		body: JSON.stringify(transformedBody),
	});

	if (wantsStream(body)) {
		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers: response.headers,
		});
	}

	if (!response.ok) {
		return response;
	}

	return convertSseToJson(response);
}
