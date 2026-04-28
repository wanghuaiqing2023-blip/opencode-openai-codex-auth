# Codex OAuth Gateway

Standalone experiment for calling the ChatGPT Codex backend from your own Python
program through a local Node.js gateway.

This project is intentionally separate from the parent OpenCode plugin. It
copies only the minimum ideas needed for personal experimentation:

## Project purpose (TL;DR)

This gateway exists to let a **single local developer** call the ChatGPT Codex backend
from custom scripts (especially Python) using official OAuth, without rebuilding all of
OpenCode plugin features.

### In scope
- Local OAuth login and token refresh
- Local `POST /responses` proxy for text/image coding requests
- Stream passthrough and non-stream SSE->JSON conversion

### Out of scope
- Multi-user auth/session management
- Production hosting/SLA hardening
- Commercial API resale scenarios

### What a product-grade gateway would additionally need

If this experiment is promoted to production, add at least:

1. **Identity & access control**
   - Multi-user auth, tenant isolation, scoped API keys/JWTs, RBAC.
2. **Security controls**
   - Secrets manager, key rotation, WAF/rate limits, audit trails, abuse detection.
3. **Reliability & scalability**
   - Stateless horizontal scaling, queues/backpressure, retries with idempotency keys.
4. **Observability & operations**
   - Structured logs, metrics, distributed tracing, SLO/alerting, runbooks.
5. **API governance**
   - Versioned contracts (OpenAPI/JSON Schema), backward compatibility policy.
6. **Data governance**
   - Data retention/PII policy, encryption at rest/in transit, deletion workflows.
7. **Developer platform basics**
   - Automated tests, CI/CD, staged deploys, canary/rollback, migration tooling.

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


## What can be tested now

> Current status: there is **no automated test suite** for this experiment yet.
> The following are **manual test scenarios** you can run today.

### 1) Build and auth flow

```bash
npm install
npm run build
npm run auth
```

What to verify:
- Browser opens the OAuth URL (or manual paste fallback works).
- After success, token file exists at `.tokens/openai.json`.

### 2) Health endpoint

Start server:

```bash
npm run start
```

In another terminal:

```bash
curl -s http://127.0.0.1:8787/health | jq
```

What to verify:
- `ok: true`
- `authenticated: true` after auth
- `tokenFile` and `expires` are populated

### 3) Non-stream request (SSE -> JSON conversion)

```bash
curl -s http://127.0.0.1:8787/responses \
  -H 'content-type: application/json' \
  -d '{
    "model": "gpt-5.2",
    "stream": false,
    "input": [{"role":"user","content":"Say hello in one sentence."}]
  }' | jq
```

What to verify:
- Returns JSON (not SSE text/event-stream).
- Response contains the final model output.

### 4) Stream request (SSE passthrough)

```bash
curl -N http://127.0.0.1:8787/responses \
  -H 'content-type: application/json' \
  -d '{
    "model": "gpt-5.2",
    "stream": true,
    "input": [{"role":"user","content":"List 3 short tips for Python debugging."}]
  }'
```

What to verify:
- `data: {...}` style SSE chunks stream progressively.
- Ends with a final completion event.

### 5) Model normalization

```bash
curl -s http://127.0.0.1:8787/responses \
  -H 'content-type: application/json' \
  -d '{
    "model": "gpt-5-codex-mini",
    "stream": false,
    "input": [{"role":"user","content":"Reply with normalized model only."}]
  }'
```

What to verify:
- Request should succeed with legacy aliases too (e.g. `gpt-5-codex-mini`, `gpt-5.2-codex-high`).

### 6) Error paths

- Delete or rename token file and call `/responses` -> should return an auth-related error.
- Send malformed JSON body -> should return server error JSON.
- Send >20MB request body -> should fail with `Request body too large.`


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
