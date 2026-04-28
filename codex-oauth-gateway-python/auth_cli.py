from gateway.auth import (
    create_authorization_flow,
    exchange_authorization_code,
    parse_authorization_input,
    save_tokens,
)


def main() -> int:
    flow = create_authorization_flow()
    print("Open this URL in your browser and complete login:\n")
    print(flow.url)
    print("\nPaste callback URL, 'code=...&state=...', or 'code#state':")
    raw = input("> ")
    code, state = parse_authorization_input(raw)

    if not code:
        print("No authorization code found.")
        return 1
    if state and state != flow.state:
        print("State mismatch. Aborting.")
        return 1

    tokens = exchange_authorization_code(code, flow.verifier)
    save_tokens(tokens)
    print("OAuth tokens saved successfully.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
