import type { GatewayRequestBody } from "../types.js";

export function wantsStream(body: GatewayRequestBody): boolean {
	return body.stream === true;
}

export async function convertSseToJson(response: Response): Promise<Response> {
	if (!response.body) {
		return response;
	}

	const text = await response.text();
	const finalResponse = parseFinalResponse(text);
	const headers = ensureContentType(response.headers);
	headers.set("content-type", "application/json; charset=utf-8");

	if (!finalResponse) {
		return new Response(text, {
			status: response.status,
			statusText: response.statusText,
			headers: ensureContentType(response.headers),
		});
	}

	return new Response(JSON.stringify(finalResponse), {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}

export function ensureContentType(headers: Headers): Headers {
	const responseHeaders = new Headers(headers);

	if (!responseHeaders.has("content-type")) {
		responseHeaders.set("content-type", "text/event-stream; charset=utf-8");
	}

	return responseHeaders;
}

export async function handleErrorResponse(response: Response): Promise<Response> {
	const mapped = await mapUsageLimit404(response);
	return mapped ?? response;
}

export async function handleSuccessResponse(
	response: Response,
	isStreaming: boolean,
): Promise<Response> {
	const responseHeaders = ensureContentType(response.headers);

	if (!isStreaming) {
		return await convertSseToJson(
			new Response(response.body, {
				status: response.status,
				statusText: response.statusText,
				headers: responseHeaders,
			}),
		);
	}

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers: responseHeaders,
	});
}

async function mapUsageLimit404(response: Response): Promise<Response | null> {
	if (response.status !== 404) return null;

	const clone = response.clone();
	let text = "";
	try {
		text = await clone.text();
	} catch {
		text = "";
	}
	if (!text) return null;

	let code = "";
	try {
		const parsed = JSON.parse(text) as {
			error?: { code?: string; type?: string };
		};
		code = (parsed?.error?.code ?? parsed?.error?.type ?? "").toString();
	} catch {
		code = "";
	}

	if (code !== "usage_limit_exceeded") {
		return null;
	}

	return new Response(response.body, {
		status: 429,
		statusText: "Too Many Requests",
		headers: response.headers,
	});
}

function parseFinalResponse(sseText: string): unknown | null {
	for (const line of sseText.split("\n")) {
		if (!line.startsWith("data: ")) continue;
		try {
			const event = JSON.parse(line.slice(6)) as {
				type?: string;
				response?: unknown;
			};
			if (
				event.type === "response.done" ||
				event.type === "response.completed"
			) {
				return event.response ?? null;
			}
		} catch {
			// Ignore malformed SSE data lines.
		}
	}
	return null;
}
