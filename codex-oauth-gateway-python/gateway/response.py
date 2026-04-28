from __future__ import annotations

import json


def parse_final_response(sse_text: str):
    text_deltas: list[str] = []
    final_response = None

    for line in sse_text.splitlines():
        if not line.startswith("data: "):
            continue
        try:
            event = json.loads(line[6:])
        except Exception:
            continue

        if event.get("type") in {"response.output_text.delta", "output_text.delta"}:
            delta = event.get("delta")
            if isinstance(delta, str):
                text_deltas.append(delta)
            continue

        if event.get("type") in {"response.done", "response.completed"}:
            final_response = event.get("response")

    if not final_response:
        return None

    if not isinstance(final_response, dict):
        return final_response

    combined_text = "".join(text_deltas).strip()
    if not combined_text:
        return final_response

    output = final_response.get("output")
    has_output = isinstance(output, list) and len(output) > 0
    if not has_output:
        final_response["output_text"] = combined_text
        final_response["output"] = [
            {
                "type": "message",
                "role": "assistant",
                "content": [{"type": "output_text", "text": combined_text}],
            }
        ]

    return final_response


def map_usage_limit_404(status_code: int, body_text: str) -> tuple[int, str]:
    if status_code != 404:
        return status_code, body_text
    try:
        parsed = json.loads(body_text)
        code = (parsed.get("error") or {}).get("code") or (parsed.get("error") or {}).get("type")
        if code == "usage_limit_exceeded":
            return 429, body_text
    except Exception:
        pass
    return status_code, body_text
