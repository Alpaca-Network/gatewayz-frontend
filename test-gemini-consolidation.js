// Test script to verify Gemini 2.5 Pro consolidation logic
// This simulates the deduplication logic from models-service.ts

const testModels = [
  {
    id: 'aimo/gemini-2.5-pro',
    canonical_slug: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider_slug: 'aimo',
    source_gateway: 'aimo',
    description: 'AIMO Network decentralized model',
    context_length: 2000000,
  },
  {
    id: 'google/gemini-2.5-pro',
    canonical_slug: 'google/gemini-2.5-pro',
    name: 'Google: Gemini 2.5 Pro',
    provider_slug: 'google',
    source_gateway: 'openrouter',
    description: 'Gemini 2.5 Pro is Google state-of-the-art AI model',
    context_length: 1048576,
  },
];

const modelMap = new Map();

for (const model of testModels) {
  // Normalize the model name
  let normalizedName = (model.name || '')
    .toLowerCase()
    .replace(/^(google:|openai:|meta:|anthropic:|models\/)/i, '')
    .replace(/\s+/g, '-')
    .replace(/[^\w-]/g, '');

  // Normalize canonical_slug with improved provider prefix removal
  let canonicalSlug = (model.canonical_slug || model.id || '').toLowerCase();

  canonicalSlug = canonicalSlug
    .replace(/^(aimo\/|google\/|openai\/|meta\/|anthropic\/|models\/|mistralai\/|xai\/)/i, '')
    .replace(/\s+/g, '-')
    .replace(/[^\w-]/g, '');

  const dedupKey = canonicalSlug || normalizedName;

  console.log(`\nProcessing: ${model.id}`);
  console.log(`  Normalized name: ${normalizedName}`);
  console.log(`  Canonical slug: ${model.canonical_slug}`);
  console.log(`  Normalized canonical: ${canonicalSlug}`);
  console.log(`  Dedup key: ${dedupKey}`);

  if (modelMap.has(dedupKey)) {
    console.log(`  ✅ DUPLICATE DETECTED - Will merge with existing model`);

    const existing = modelMap.get(dedupKey);

    // Merge gateways
    const existingGateways = Array.isArray(existing.source_gateways)
      ? existing.source_gateways
      : (existing.source_gateway ? [existing.source_gateway] : []);

    const newGateways = Array.isArray(model.source_gateways)
      ? model.source_gateways
      : (model.source_gateway ? [model.source_gateway] : []);

    const combinedGateways = Array.from(new Set([...existingGateways, ...newGateways]));

    // Merge providers
    const existingProviders = Array.isArray(existing.provider_slugs)
      ? existing.provider_slugs
      : (existing.provider_slug ? [existing.provider_slug] : []);

    const newProviders = model.provider_slug ? [model.provider_slug] : [];
    const combinedProviders = Array.from(new Set([...existingProviders, ...newProviders]));

    console.log(`  Combined gateways: ${combinedGateways.join(', ')}`);
    console.log(`  Combined providers: ${combinedProviders.join(', ')}`);

    // Keep model with better metadata
    const existingScore = (existing.description ? 1 : 0) +
                          (existing.pricing?.prompt ? 1 : 0) +
                          (existing.context_length > 0 ? 1 : 0);

    const newScore = (model.description ? 1 : 0) +
                     (model.pricing?.prompt ? 1 : 0) +
                     (model.context_length > 0 ? 1 : 0);

    console.log(`  Existing score: ${existingScore}, New score: ${newScore}`);

    const mergedModel = newScore > existingScore ? model : existing;
    mergedModel.source_gateways = combinedGateways;
    mergedModel.provider_slugs = combinedProviders;

    console.log(`  Using model: ${mergedModel.id}`);

    modelMap.set(dedupKey, mergedModel);
  } else {
    console.log(`  ➕ NEW MODEL - Adding to map`);

    if (!Array.isArray(model.source_gateways) && model.source_gateway) {
      model.source_gateways = [model.source_gateway];
    } else if (!model.source_gateways) {
      model.source_gateways = [];
    }

    model.provider_slugs = model.provider_slug ? [model.provider_slug] : [];

    modelMap.set(dedupKey, model);
  }
}

console.log('\n\n=== FINAL RESULT ===');
console.log(`Total unique models: ${modelMap.size}`);
console.log('\nMerged model details:');

for (const [key, model] of modelMap.entries()) {
  console.log(`\nKey: ${key}`);
  console.log(`  ID: ${model.id}`);
  console.log(`  Name: ${model.name}`);
  console.log(`  Gateways: ${model.source_gateways.join(', ')}`);
  console.log(`  Providers: ${model.provider_slugs.join(', ')}`);
}

if (modelMap.size === 1) {
  console.log('\n✅ SUCCESS: Both Gemini 2.5 Pro models were consolidated into one!');
} else {
  console.log('\n❌ FAILURE: Models were not consolidated properly');
  process.exit(1);
}
