const fs = require('fs');

async function analyzeDeduplication() {
  console.log('🔍 Analyzing Model Deduplication Across Gateways\n');
  console.log('=' .repeat(80));

  const gateways = [
    'openrouter',
    'featherless',
    'groq',
    'together',
    'fireworks',
    'chutes',
    'deepinfra',
    'google',
    'cerebras',
    'nebius',
    'xai',
    'novita',
    'huggingface'
  ];

  const gatewayModels = new Map();
  const modelToGateways = new Map();

  // Fetch models from each gateway
  for (const gateway of gateways) {
    try {
      const limit = gateway === 'huggingface' ? '50000' : '';
      const url = `https://api.gatewayz.ai/v1/models?gateway=${gateway}${limit ? '&limit=' + limit : ''}`;

      console.log(`\n📡 Fetching from ${gateway}...`);

      const response = await fetch(url, {
        signal: AbortSignal.timeout(60000)
      });

      if (!response.ok) {
        console.log(`   ❌ Failed: ${response.status}`);
        continue;
      }

      const data = await response.json();
      const models = data.data || [];

      console.log(`   ✅ Fetched ${models.length} models`);

      gatewayModels.set(gateway, models);

      // Track which gateways have each model
      for (const model of models) {
        if (!model.id) continue;

        if (!modelToGateways.has(model.id)) {
          modelToGateways.set(model.id, new Set());
        }
        modelToGateways.get(model.id).add(gateway);
      }

    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('\n📊 DEDUPLICATION ANALYSIS REPORT\n');

  // Count unique models across all gateways
  const uniqueModelIds = new Set();
  gatewayModels.forEach((models) => {
    models.forEach(model => {
      if (model.id) uniqueModelIds.add(model.id);
    });
  });

  console.log(`Total Models Across All Gateways (with duplicates): ${Array.from(gatewayModels.values()).reduce((sum, models) => sum + models.length, 0)}`);
  console.log(`Total Unique Models (after deduplication): ${uniqueModelIds.size}\n`);

  // Analyze HuggingFace specifically
  const hfModels = gatewayModels.get('huggingface') || [];
  const hfModelIds = new Set(hfModels.map(m => m.id).filter(Boolean));

  console.log('🤗 HUGGINGFACE ANALYSIS:');
  console.log(`   Total HF models fetched: ${hfModels.length}`);
  console.log(`   Unique HF model IDs: ${hfModelIds.size}\n`);

  // Find HF models that are duplicated in other gateways
  const hfDuplicatedInOtherGateways = [];
  const hfUniqueToHF = [];

  for (const modelId of hfModelIds) {
    const gateways = modelToGateways.get(modelId) || new Set();
    if (gateways.size > 1) {
      hfDuplicatedInOtherGateways.push({
        id: modelId,
        gateways: Array.from(gateways).filter(g => g !== 'huggingface')
      });
    } else {
      hfUniqueToHF.push(modelId);
    }
  }

  console.log(`   HF models UNIQUE to HuggingFace: ${hfUniqueToHF.length}`);
  console.log(`   HF models DUPLICATED in other gateways: ${hfDuplicatedInOtherGateways.length}\n`);

  // Show breakdown by gateway overlap
  console.log('📈 HuggingFace Model Overlap by Gateway:\n');

  const overlapByGateway = {};
  for (const item of hfDuplicatedInOtherGateways) {
    for (const gateway of item.gateways) {
      overlapByGateway[gateway] = (overlapByGateway[gateway] || 0) + 1;
    }
  }

  Object.entries(overlapByGateway)
    .sort((a, b) => b[1] - a[1])
    .forEach(([gateway, count]) => {
      const percentage = ((count / hfModelIds.size) * 100).toFixed(1);
      console.log(`   ${gateway.padEnd(15)} ${count.toString().padStart(6)} models (${percentage}% of HF)`);
    });

  // Show sample duplicates
  console.log('\n📋 Sample Duplicated Models (first 20):\n');
  hfDuplicatedInOtherGateways.slice(0, 20).forEach((item, idx) => {
    console.log(`   ${(idx + 1).toString().padStart(2)}. ${item.id}`);
    console.log(`       Also in: ${item.gateways.join(', ')}\n`);
  });

  // Show sample unique HF models
  console.log('📋 Sample Models UNIQUE to HuggingFace (first 20):\n');
  hfUniqueToHF.slice(0, 20).forEach((id, idx) => {
    console.log(`   ${(idx + 1).toString().padStart(2)}. ${id}`);
  });

  console.log('\n' + '='.repeat(80));
  console.log('\n✅ Analysis Complete!\n');

  // Summary
  console.log('📌 SUMMARY:');
  console.log(`   • Out of ${hfModelIds.size} HuggingFace models:`);
  console.log(`   • ${hfUniqueToHF.length} are UNIQUE to HuggingFace`);
  console.log(`   • ${hfDuplicatedInOtherGateways.length} are DUPLICATED across other gateways`);
  console.log(`   • After deduplication: ${uniqueModelIds.size} total unique models across all gateways\n`);
}

analyzeDeduplication().catch(console.error);
