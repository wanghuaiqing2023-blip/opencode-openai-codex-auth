import http from "node:http";

const SUCCESS_HTML = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Codex OAuth Gateway</title></head>
<body style="font-family: system-ui, sans-serif; padding: 2rem;">
  <h1>Authentication complete</h1>
  <p>You can close this tab and return to your terminal.</p>
</body>
</html>`;

export interface CallbackServer {
	url: string;
	close: () => void;
	waitForCode: () => Promise<string | null>;
}

export function startCallbackServer(state: string): Promise<CallbackServer> {
	let lastCode: string | null = null;

	const server = http.createServer((req, res) => {
		try {
			const url = new URL(req.url ?? "", "http://localhost:1455");
			if (url.pathname !== "/auth/callback") {
				res.statusCode = 404;
				res.end("Not found");
				return;
			}

			if (url.searchParams.get("state") !== state) {
				res.statusCode = 400;
				res.end("State mismatch");
				return;
			}

			const code = url.searchParams.get("code");
			if (!code) {
				res.statusCode = 400;
				res.end("Missing authorization code");
				return;
			}

			lastCode = code;
			res.statusCode = 200;
			res.setHeader("Content-Type", "text/html; charset=utf-8");
			res.end(SUCCESS_HTML);
		} catch {
			res.statusCode = 500;
			res.end("Internal error");
		}
	});

	return new Promise((resolve, reject) => {
		server.once("error", reject);
		server.listen(1455, "127.0.0.1", () => {
			server.removeAllListeners("error");
			resolve({
				url: "http://localhost:1455/auth/callback",
				close: () => server.close(),
				waitForCode: async () => {
					for (let i = 0; i < 6000; i++) {
						if (lastCode) return lastCode;
						await new Promise((done) => setTimeout(done, 100));
					}
					return null;
				},
			});
		});
	});
}
