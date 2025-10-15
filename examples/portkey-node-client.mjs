#!/usr/bin/env node
/**
 * Minimal Node.js helper that talks directly to Portkey using the official SDK.
 *
 * Usage:
 *   1. npm install portkey-ai
 *   2. export PORTKEY_API_KEY=pk_live_xxx
 *      export PORTKEY_VIRTUAL_KEY_OPENAI=vk_live_xxx   # or PORTKEY_VIRTUAL_KEY
 *   3. node examples/portkey-node-client.mjs
 *
 * You can override the default model by setting PORTKEY_MODEL.
 */
import { Portkey } from "portkey-ai";

const PORTKEY_API_KEY = process.env.PORTKEY_API_KEY;
const PORTKEY_VIRTUAL_KEY =
  process.env.PORTKEY_VIRTUAL_KEY_OPENAI ?? process.env.PORTKEY_VIRTUAL_KEY ?? null;
const PORTKEY_PROVIDER_SLUG =
  process.env.PORTKEY_PROVIDER_SLUG ?? PORTKEY_VIRTUAL_KEY ?? "openai";

if (!PORTKEY_API_KEY) {
  console.error("PORTKEY_API_KEY is not set. Please export it before running this script.");
  process.exit(1);
}

const portkey = new Portkey({
  apiKey: PORTKEY_API_KEY,
  virtualKey: PORTKEY_VIRTUAL_KEY ?? undefined,
  baseURL: process.env.PORTKEY_BASE_URL ?? "https://api.portkey.ai/v1",
});

async function main() {
  const baseModel = process.env.PORTKEY_MODEL ?? "gpt-3.5-turbo";
  const providerSlug = PORTKEY_PROVIDER_SLUG.replace(/^@/, "");

  let model;
  if (baseModel.startsWith("@")) {
    model = baseModel;
  } else if (baseModel.includes("/")) {
    model = baseModel.startsWith("@") ? baseModel : `@${baseModel}`;
  } else {
    model = `@${providerSlug}/${baseModel}`;
  }
  const completion = await portkey.chat.completions.create({
    model,
    messages: [
      { role: "user", content: "Give me a one sentence status update from Portkey." },
    ],
  });

  console.log(JSON.stringify(completion, null, 2));
}

main().catch((err) => {
  const body = err?.response?.data ?? err?.message ?? err;
  console.error("Portkey request failed:", body);
  process.exit(1);
});
