// Adds Gatewayz as a provider to OpenCode's config, keeping everything else.
// Usage: node merge-config.js <config path> <base url>   (key read from GATEWAYZ_API_KEY)
// Embedded in the setup scripts; kept here so it can be read and tested.
const fs = require("fs");
const path = require("path");

const [configPath, baseURL] = process.argv.slice(2);
const apiKey = process.env.GATEWAYZ_API_KEY;
if (!configPath || !baseURL || !apiKey) {
  console.error("usage: GATEWAYZ_API_KEY=... node merge-config.js <config> <base url>");
  process.exit(2);
}

// Models that answered tool calls through Gatewayz on 2026-11-25.
const MODELS = {
  "anthropic/claude-sonnet-5-5": "Claude Sonnet 5.5",
  "anthropic/claude-haiku-4-5-20251001": "Claude Haiku 4.5",
  "openai/gpt-5.5": "GPT-5.5",
  "openai/gpt-5.4-mini": "GPT-5.4 mini",
  "grok-4": "Grok 4",
  "moonshot/kimi-k2.6": "Kimi K2.6",
  "deepseek-ai/DeepSeek-V4.1-Flash": "DeepSeek V4.1 Flash",
  "deepseek-ai/DeepSeek-V4-Pro": "DeepSeek V4 Pro",
  "Qwen/Qwen3-Coder-480B-A35B-Instruct-Turbo": "Qwen3 Coder 480B",
  "zai-org/GLM-5.3": "GLM-5.3",
};

let config = {};
if (fs.existsSync(configPath)) {
  try {
    config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch (err) {
    // Never overwrite a config we cannot read: the user may have comments or
    // a syntax error in it. Stop and say so.
    console.error(`Could not read ${configPath} as JSON (${err.message}). Not changing it.`);
    process.exit(3);
  }
  fs.copyFileSync(configPath, configPath + ".bak-gatewayz");
  fs.chmodSync(configPath + ".bak-gatewayz", 0o600);
}

config.$schema = config.$schema || "https://opencode.ai/config.json";
config.provider = config.provider || {};
config.provider.gatewayz = {
  npm: "@ai-sdk/openai-compatible",
  name: "Gatewayz",
  options: { baseURL: `${baseURL.replace(/\/+$/, "")}/v1`, apiKey },
  models: Object.fromEntries(Object.entries(MODELS).map(([id, name]) => [id, { name }])),
};
if (!config.model) config.model = "gatewayz/anthropic/claude-sonnet-5-5";

fs.mkdirSync(path.dirname(configPath), { recursive: true });
fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", { mode: 0o600 });
fs.chmodSync(configPath, 0o600);
console.log(`Gatewayz provider added to ${configPath}`);
