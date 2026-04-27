const MODEL_MAP: Record<string, string> = {
	"gpt-5.2": "gpt-5.2",
	"gpt-5.2-none": "gpt-5.2",
	"gpt-5.2-low": "gpt-5.2",
	"gpt-5.2-medium": "gpt-5.2",
	"gpt-5.2-high": "gpt-5.2",
	"gpt-5.2-xhigh": "gpt-5.2",
	"gpt-5.2-codex": "gpt-5.2-codex",
	"gpt-5.2-codex-low": "gpt-5.2-codex",
	"gpt-5.2-codex-medium": "gpt-5.2-codex",
	"gpt-5.2-codex-high": "gpt-5.2-codex",
	"gpt-5.2-codex-xhigh": "gpt-5.2-codex",
	"gpt-5.1": "gpt-5.1",
	"gpt-5.1-none": "gpt-5.1",
	"gpt-5.1-low": "gpt-5.1",
	"gpt-5.1-medium": "gpt-5.1",
	"gpt-5.1-high": "gpt-5.1",
	"gpt-5.1-codex": "gpt-5.1-codex",
	"gpt-5.1-codex-low": "gpt-5.1-codex",
	"gpt-5.1-codex-medium": "gpt-5.1-codex",
	"gpt-5.1-codex-high": "gpt-5.1-codex",
	"gpt-5.1-codex-max": "gpt-5.1-codex-max",
	"gpt-5.1-codex-max-low": "gpt-5.1-codex-max",
	"gpt-5.1-codex-max-medium": "gpt-5.1-codex-max",
	"gpt-5.1-codex-max-high": "gpt-5.1-codex-max",
	"gpt-5.1-codex-max-xhigh": "gpt-5.1-codex-max",
	"gpt-5.1-codex-mini": "gpt-5.1-codex-mini",
	"gpt-5.1-codex-mini-medium": "gpt-5.1-codex-mini",
	"gpt-5.1-codex-mini-high": "gpt-5.1-codex-mini",
	"gpt-5": "gpt-5.1",
	"gpt-5-codex": "gpt-5.1-codex",
	"gpt-5-codex-mini": "gpt-5.1-codex-mini",
	"codex-mini-latest": "gpt-5.1-codex-mini",
};

export function normalizeModel(model: string | undefined): string {
	if (!model) return "gpt-5.2";
	const modelId = model.includes("/") ? model.split("/").pop()! : model;
	const direct = MODEL_MAP[modelId] ?? MODEL_MAP[modelId.toLowerCase()];
	if (direct) return direct;

	const lower = modelId.toLowerCase();
	if (lower.includes("gpt-5.2-codex")) return "gpt-5.2-codex";
	if (lower.includes("gpt-5.2")) return "gpt-5.2";
	if (lower.includes("codex-mini")) return "gpt-5.1-codex-mini";
	if (lower.includes("codex-max")) return "gpt-5.1-codex-max";
	if (lower.includes("codex")) return "gpt-5.1-codex";
	if (lower.includes("gpt-5.1")) return "gpt-5.1";
	if (lower.includes("gpt-5")) return "gpt-5.1";
	return modelId;
}
