import { readConfigFile } from "./index";

interface ProviderAccount {
  id?: string;
  key: string;
  email?: string;
  label?: string;
}

interface Provider {
  name: string;
  api_base_url: string;
  accounts?: ProviderAccount[];
  key?: string;
  models?: string[];
  dynamic_discovery_url?: string;
}

/**
 * Resolve the models list endpoint URL for a provider.
 * Uses dynamic_discovery_url if set, otherwise derives from api_base_url.
 */
function getModelsUrl(provider: Provider): string | null {
  if (provider.dynamic_discovery_url) {
    const base = provider.dynamic_discovery_url.replace(/\/+$/, "");
    return `${base}/v1/models`;
  }

  const url = provider.api_base_url;

  // Cloudflare: swap /ai/v1/chat/completions for /ai/models/search
  if (url.includes("cloudflare.com")) {
    const accountId = provider.accounts?.[0]?.id;
    if (!accountId) return null;
    return `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/models/search?per_page=200&task=Text%20Generation`;
  }

  // Cohere compatibility endpoint -> /v1/models
  if (url.includes("cohere.com")) {
    return "https://api.cohere.com/v2/models";
  }

  // Google AI Studio OpenAI compat -> /models
  if (url.includes("generativelanguage.googleapis.com")) {
    return "https://generativelanguage.googleapis.com/v1beta/openai/models";
  }

  // Generic OpenAI-compatible: strip /chat/completions, append /models
  const base = url.replace(/\/chat\/completions\/?$/, "");
  return `${base}/models`;
}

/**
 * Parse the model list response from various provider formats.
 */
function parseModels(providerName: string, json: any): string[] {
  // OpenAI-compatible: { data: [{id: ...}] }
  if (json.data && Array.isArray(json.data)) {
    return json.data.map((m: any) => {
      let id = m.id;
      // Strip "models/" prefix from Google AI Studio model IDs
      if (typeof id === "string" && id.startsWith("models/")) {
        id = id.slice(7);
      }
      return id;
    }).filter(Boolean).sort();
  }
  // Cohere: { models: [{name: ...}] }
  if (json.models && Array.isArray(json.models)) {
    return json.models.map((m: any) => m.name || m.id).filter(Boolean).sort();
  }
  // Cloudflare: { result: [{name: ...}] }
  if (json.result && Array.isArray(json.result)) {
    return json.result.map((m: any) => m.name).filter(Boolean).sort();
  }
  return [];
}

async function fetchModels(provider: Provider): Promise<{ models?: string[]; error?: string }> {
  const modelsUrl = getModelsUrl(provider);
  if (!modelsUrl) {
    return { error: "Cannot determine models endpoint" };
  }

  const key = provider.accounts?.[0]?.key || provider.key;
  if (!key) {
    return { error: "No API key configured" };
  }

  try {
    const res = await fetch(modelsUrl, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { error: `HTTP ${res.status} ${res.statusText}${body ? ": " + body.slice(0, 120) : ""}` };
    }

    const json = await res.json();
    const models = parseModels(provider.name, json);
    if (models.length === 0) {
      return { error: "No models returned (unexpected response format)" };
    }
    return { models };
  } catch (e: any) {
    return { error: e.message };
  }
}

function filterChatModels(models: string[]): string[] {
  const exclude = /embed|rerank|safety|guard|moderation|whisper|tts|image|video|veo|imagen|lyria|robotics|aqa|deep-research|clip|deplot|kosmos|neva|parse|detector|reward|calibration|pii|transcribe|realtime|audio|nano-banana|gemma-/i;
  return models.filter((m) => !exclude.test(m));
}

export async function handleModelsCommand(args: string[]) {
  const config = await readConfigFile();
  const providers: Provider[] = config.Providers || [];

  if (providers.length === 0) {
    console.log("No providers configured. Add providers to ~/.claude-code-router/config.json");
    process.exit(1);
  }

  const filterName = args[0];
  const showAll = args.includes("--all") || args.includes("-a");
  const showHelp = args.includes("--help") || args.includes("-h");

  if (showHelp) {
    console.log(`
Usage: ccr models [provider-name] [options]

List available models from your configured providers.

Arguments:
  provider-name   Show models for a specific provider only

Options:
  -a, --all       Show all models (including embeddings, safety, etc.)
  -h, --help      Show this help

Examples:
  ccr models              # List chat models from all providers
  ccr models groq         # List models for groq only
  ccr models --all        # Include non-chat models (embeddings, etc.)
`);
    return;
  }

  // Filter to specific provider if requested
  const targetProviders = filterName && !filterName.startsWith("-")
    ? providers.filter((p) => p.name.toLowerCase().includes(filterName.toLowerCase()))
    : providers;

  if (targetProviders.length === 0) {
    console.log(`No provider matching "${filterName}" found.`);
    console.log("Available providers: " + providers.map((p) => p.name).join(", "));
    process.exit(1);
  }

  console.log("");

  for (const provider of targetProviders) {
    const accounts = provider.accounts || [];
    const keyCount = accounts.length || (provider.key ? 1 : 0);
    console.log(`\x1b[1m${provider.name}\x1b[0m  (${keyCount} account${keyCount !== 1 ? "s" : ""})`);

    const result = await fetchModels(provider);

    if (result.error) {
      console.log(`  \x1b[31m✗ ${result.error}\x1b[0m`);
    } else if (result.models) {
      const display = showAll ? result.models : filterChatModels(result.models);
      const configured = new Set(provider.models || []);

      for (const model of display) {
        const marker = configured.has(model) ? "\x1b[32m●\x1b[0m" : " ";
        console.log(`  ${marker} ${model}`);
      }
      console.log(`  \x1b[2m${display.length} model${display.length !== 1 ? "s" : ""}${!showAll && display.length < result.models.length ? ` (${result.models.length - display.length} hidden, use --all)` : ""}\x1b[0m`);
    }
    console.log("");
  }

  console.log("\x1b[32m●\x1b[0m = configured in your config.json");
}
