# Codex OAuth Gateway

Standalone experiment for calling the ChatGPT Codex backend from your own Python
program through a local Node.js gateway.

This project is intentionally separate from the parent OpenCode plugin. It
copies only the minimum ideas needed for personal experimentation:

- OAuth login with PKCE
- Local callback on `http://localhost:1455/auth/callback`
- Access-token refresh
- ChatGPT account id extraction from the access-token JWT
- `POST /responses` proxying to `https://chatgpt.com/backend-api/codex/responses`
- Forced `store: false`
- `include: ["reasoning.encrypted_content"]`

## Usage

From this directory:

```bash
npm install
npm run build
npm run auth
npm run start
```

Then, in another terminal:

```bash
python python/main.py
```

The token file is stored locally at:

```text
.tokens/openai.json
```

Do not commit or share that file.

## HTTP API

```http
GET /health
POST /responses
```

Example request:

```json
{
  "model": "gpt-5.2",
  "input": [
    { "role": "user", "content": "Explain Python decorators." }
  ],
  "stream": false
}
```

The gateway fills in defaults:

```json
{
  "store": false,
  "stream": true,
  "reasoning": { "effort": "medium", "summary": "auto" },
  "text": { "verbosity": "medium" },
  "include": ["reasoning.encrypted_content"]
}
```

For `stream: false`, the gateway converts the Codex SSE response into the final
JSON response. For `stream: true`, it passes the SSE stream through.

## Notes

This is for personal local development with your own ChatGPT Plus/Pro account.
For production, commercial, multi-user, or resale use cases, use the OpenAI
Platform API instead.
