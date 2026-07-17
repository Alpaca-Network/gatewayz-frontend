const gateways = [
  'openrouter', 'featherless', 'groq', 'together', 'fireworks',
  'chutes', 'deepinfra', 'google', 'cerebras', 'nebius',
  'xai', 'novita', 'huggingface', 'aimo', 'near', 'fal'
];

async function getModelCounts() {
  console.log('📊 Model Count Per Gateway\n');
  console.log('='.repeat(70));

  let totalModels = 0;
  const results = [];

  for (const gateway of gateways) {
    try {
      const limit = gateway === 'huggingface' ? '50000' : '';
      const url = `https://api.gatewayz.ai/v1/models?gateway=${gateway}${limit ? '&limit=' + limit : ''}`;

      console.log(`Fetching ${gateway}...`);
      const response = await fetch(url, {
        signal: AbortSignal.timeout(60000)
      });

      if (response.ok) {
        const data = await response.json();
        const count = data.data?.length || 0;
        const uniqueIds = new Set(data.data?.map(m => m.id) || []);

        results.push({
          gateway,
          total: count,
          unique: uniqueIds.size,
          duplicates: count - uniqueIds.size
        });

        totalModels += count;
      } else {
        results.push({ gateway, total: 0, unique: 0, duplicates: 0, error: true });
      }
    } catch (error) {
      console.log(`Error fetching ${gateway}:`, error.message);
      results.push({ gateway, total: 0, unique: 0, duplicates: 0, error: true });
    }
  }

  console.log('\n' + '='.repeat(70));

  // Sort by total count descending
  results.sort((a, b) => b.total - a.total);

  console.log('\nGateway              Total    Unique   Duplicates   Status');
  console.log('-'.repeat(70));

  for (const r of results) {
    const status = r.error ? '❌ Error' :
                   r.duplicates > 0 ? '⚠️  Has Dupes' : '✅ OK';
    const gateway = r.gateway.padEnd(18);
    const total = r.total.toString().padStart(7);
    const unique = r.unique.toString().padStart(7);
    const dupes = r.duplicates.toString().padStart(10);

    console.log(`${gateway} ${total}  ${unique}  ${dupes}   ${status}`);
  }

  console.log('-'.repeat(70));
  console.log(`TOTAL (with dupes)   ${totalModels.toString().padStart(7)}`);

  // Calculate unique across all gateways
  const allUniqueIds = new Set();
  for (const r of results) {
    if (!r.error && r.unique > 0) {
      // We'd need to fetch again to get actual IDs, so just note this
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('\n💡 Key Findings:');
  const hfResult = results.find(r => r.gateway === 'huggingface');
  if (hfResult && hfResult.duplicates > 0) {
    console.log(`   • HuggingFace has ${hfResult.duplicates.toLocaleString()} duplicate entries!`);
    console.log(`   • Only ${hfResult.unique} unique models out of ${hfResult.total.toLocaleString()} returned`);
    console.log(`   • Duplication factor: ${(hfResult.total / hfResult.unique).toFixed(0)}x`);
  }

  console.log('\n');
}

getModelCounts().catch(console.error);
