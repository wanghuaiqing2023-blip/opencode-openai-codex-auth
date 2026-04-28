import {
	CODEX_RESPONSES_URL,
	DEFAULT_UPSTREAM_TIMEOUT_MS,
	DEFAULT_INSTRUCTIONS,
	OPENAI_HEADER_VALUES,
	OPENAI_HEADERS,
} from "../constants.js";
import { GatewayError } from "../errors.js";
import type { GatewayRequestBody } from "../types.js";
import { normalizeModel } from "./model.js";
import {
	handleErrorResponse,
	handleSuccessResponse,
	wantsStream,
} from "./response.js";

function ensureInclude(include: string[] | undefined): string[] {
	const merged = new Set(include ?? []);
	merged.add("reasoning.encrypted_content");
	return Array.from(merged);
}

function transformBody(input: GatewayRequestBody): GatewayRequestBody {
	if (!input.input) {
		throw new GatewayError(
			400,
			"MISSING_INPUT",
			"Request body must include an input field.",
		);
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
	const timeoutMs = Number(
		process.env.CODEX_UPSTREAM_TIMEOUT_MS ?? DEFAULT_UPSTREAM_TIMEOUT_MS,
	);
	const timeoutSignal = AbortSignal.timeout(
		Number.isFinite(timeoutMs) && timeoutMs > 0
			? timeoutMs
			: DEFAULT_UPSTREAM_TIMEOUT_MS,
	);

	let response: Response;
	try {
		response = await fetch(CODEX_RESPONSES_URL, {
			method: "POST",
			headers: createHeaders(
				accessToken,
				accountId,
				transformedBody.prompt_cache_key,
			),
			body: JSON.stringify(transformedBody),
			signal: timeoutSignal,
		});
	} catch (error) {
		if (
			error instanceof DOMException &&
			error.name === "TimeoutError"
		) {
			throw new GatewayError(
				504,
				"UPSTREAM_TIMEOUT",
				"Upstream Codex request timed out.",
				{
					timeoutMs,
					upstreamRetryAttempts: 0,
				},
			);
		}

		throw new GatewayError(
			502,
			"UPSTREAM_REQUEST_FAILED",
			"Failed to reach upstream Codex service.",
			{
				upstreamRetryAttempts: 0,
				cause: error instanceof Error ? error.message : String(error),
			},
		);
	}

	if (!response.ok) {
		return await handleErrorResponse(response);
	}

	return await handleSuccessResponse(response, wantsStream(body));
}
