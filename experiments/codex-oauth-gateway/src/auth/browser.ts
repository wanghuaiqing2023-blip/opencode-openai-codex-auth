import { spawn } from "node:child_process";

function getBrowserOpener(): string {
	if (process.platform === "darwin") return "open";
	if (process.platform === "win32") return "start";
	return "xdg-open";
}

export function openBrowser(url: string): boolean {
	try {
		const child = spawn(getBrowserOpener(), [url], {
			stdio: "ignore",
			shell: process.platform === "win32",
			windowsHide: true,
		});
		child.on("error", () => {});
		return true;
	} catch {
		return false;
	}
}
