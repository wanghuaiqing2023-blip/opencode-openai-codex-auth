import json
import urllib.request


def ask(prompt: str) -> dict:
    payload = {
        "model": "gpt-5.2",
        "input": [
            {
                "role": "user",
                "content": prompt,
            }
        ],
        "stream": False,
    }

    request = urllib.request.Request(
        "http://127.0.0.1:8787/responses",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    with urllib.request.urlopen(request, timeout=120) as response:
        return json.loads(response.read().decode("utf-8"))


if __name__ == "__main__":
    result = ask("用三句话解释 Python 装饰器。")
    print(json.dumps(result, ensure_ascii=False, indent=2))
