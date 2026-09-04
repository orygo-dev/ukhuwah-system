export const AI_PROVIDERS = {
  openai: {
    name: "OpenAI",
    slug: "openai",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"],
    keyPrefix: "sk-",
  },
  gemini: {
    name: "Google Gemini",
    slug: "gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    defaultModel: "gemini-2.5-pro",
    models: [
      "gemini-2.5-pro",
      "gemini-2.5-flash",
      "gemini-flash-latest",
      "gemini-3.5-flash",
    ],
    keyPrefix: "AI",
  },
  openrouter: {
    name: "OpenRouter",
    slug: "openrouter",
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "openai/gpt-4o-mini",
    models: [
      "openai/gpt-4o-mini",
      "openai/gpt-4o",
      "anthropic/claude-3.5-sonnet",
      "google/gemini-flash-1.5",
    ],
    keyPrefix: "sk-or-",
  },
  claude: {
    name: "Anthropic Claude",
    slug: "claude",
    baseUrl: "https://api.anthropic.com/v1",
    defaultModel: "claude-3-5-sonnet-20241022",
    models: ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022"],
    keyPrefix: "sk-ant-",
  },
} as const;

export type AiProviderSlug = keyof typeof AI_PROVIDERS;

export const PLACEHOLDER_KEYS = [
  "sk-placeholder",
  "placeholder",
  "SB-Mid-server-placeholder",
  "SB-Mid-client-placeholder",
];

export function isPlaceholderKey(key: string): boolean {
  if (!key || key.length < 8) return true;
  return PLACEHOLDER_KEYS.some((p) => key.includes(p));
}

/** Encrypted blob from encrypt() — not a usable API key if decrypt fails */
export function looksEncryptedBlob(value: string): boolean {
  return (
    /^[A-Za-z0-9+/=]{40,}$/.test(value) &&
    !value.startsWith("sk-") &&
    !value.startsWith("AIza")
  );
}

/** Legacy Gemini model IDs → current API-supported names */
const GEMINI_MODEL_ALIASES: Record<string, string> = {
  "gemini-1.5-flash": "gemini-2.5-flash",
  "gemini-1.5-flash-latest": "gemini-2.5-flash",
  "gemini-1.5-flash-8b": "gemini-2.5-flash",
  "gemini-1.5-pro": "gemini-2.5-pro",
  "gemini-1.5-pro-latest": "gemini-2.5-pro",
  "gemini-2.0-flash": "gemini-2.5-flash",
  "gemini-2.0-flash-lite": "gemini-2.5-flash",
};

export function normalizeGeminiModel(model: string): string {
  const trimmed = model?.trim() || "";
  return GEMINI_MODEL_ALIASES[trimmed] || trimmed || AI_PROVIDERS.gemini.defaultModel;
}

export const GEMINI_FALLBACK_MODELS = [
  "gemini-2.5-flash",
  "gemini-flash-latest",
  "gemini-3.5-flash",
] as const;
