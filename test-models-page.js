/**
 * Test script to verify models page fetches all models correctly
 * This simulates what the models page server component does
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.gatewayz.ai';

async function testModelsPage() {
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

  console.log('Testing models page data fetching...\n');
  console.log('═══════════════════════════════════════════════\n');

  let totalModels = 0;
  const gatewayResults = [];

  for (const gateway of gateways) {
    try {
      const limit = gateway === 'huggingface' ? 50000 : (gateway === 'featherless' ? 10000 : undefined);
      const limitParam = limit ? `&limit=${limit}` : '&limit=50000';
      const url = `${API_BASE_URL}/v1/models?gateway=${gateway}${limitParam}`;

      console.log(`Fetching ${gateway}...`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 70000);

      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const count = data.data?.length || 0;
        totalModels += count;
        gatewayResults.push({ gateway, count, status: 'success' });
        console.log(`  ✅ ${gateway}: ${count} models`);
      } else {
        gatewayResults.push({ gateway, count: 0, status: 'failed', error: `HTTP ${response.status}` });
        console.log(`  ❌ ${gateway}: Failed (HTTP ${response.status})`);
      }
    } catch (error) {
      gatewayResults.push({ gateway, count: 0, status: 'error', error: error.message });
      console.log(`  ❌ ${gateway}: Error - ${error.message}`);
    }
  }

  console.log('\n═══════════════════════════════════════════════');
  console.log('SUMMARY');
  console.log('═══════════════════════════════════════════════\n');

  const successful = gatewayResults.filter(r => r.status === 'success');
  const failed = gatewayResults.filter(r => r.status !== 'success');

  console.log(`Total models fetched: ${totalModels}`);
  console.log(`Successful gateways: ${successful.length}/${gateways.length}`);
  console.log(`Failed gateways: ${failed.length}/${gateways.length}`);

  if (failed.length > 0) {
    console.log('\nFailed gateways:');
    failed.forEach(r => {
      console.log(`  - ${r.gateway}: ${r.error}`);
    });
  }

  console.log('\nTop 5 gateways by model count:');
  const top5 = [...gatewayResults]
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  top5.forEach((r, i) => {
    console.log(`  ${i + 1}. ${r.gateway}: ${r.count.toLocaleString()} models`);
  });

  console.log('\n═══════════════════════════════════════════════\n');

  // After deduplication, we expect fewer unique models
  console.log('Note: The actual page deduplicates models by ID across gateways.');
  console.log('Expected unique models: ~1,200-5,000 (depending on overlap)\n');
}

testModelsPage().catch(console.error);
