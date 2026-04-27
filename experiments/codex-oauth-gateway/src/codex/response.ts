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
	const headers = new Headers(response.headers);
	headers.set("content-type", "application/json; charset=utf-8");

	if (!finalResponse) {
		return new Response(
			JSON.stringify({
				error: "Could not find response.done event in Codex SSE response.",
				raw: text,
			}),
			{ status: 502, headers },
		);
	}

	return new Response(JSON.stringify(finalResponse), {
		status: response.status,
		statusText: response.statusText,
		headers,
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
