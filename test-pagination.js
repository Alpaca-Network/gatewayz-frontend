async function testPagination() {
  console.log('🔍 Testing HuggingFace Backend Pagination\n');
  console.log('='.repeat(70));

  const offsets = [0, 100, 200, 500, 1000];

  for (const offset of offsets) {
    try {
      const url = `https://api.gatewayz.ai/v1/models?gateway=huggingface&limit=100&offset=${offset}`;
      console.log(`\n📡 Fetching offset=${offset}...`);

      const response = await fetch(url, { signal: AbortSignal.timeout(30000) });

      if (!response.ok) {
        console.log(`   ❌ HTTP ${response.status}`);
        continue;
      }

      const data = await response.json();
      const models = data.data || [];

      console.log(`   ✅ Returned: ${models.length} models`);

      if (models.length > 0) {
        console.log(`   First 3 IDs:`);
        models.slice(0, 3).forEach((m, i) => {
          console.log(`      ${i + 1}. ${m.id}`);
        });

        // Check for duplicates within this page
        const ids = models.map(m => m.id);
        const uniqueIds = new Set(ids);
        if (ids.length !== uniqueIds.size) {
          console.log(`   ⚠️  WARNING: ${ids.length - uniqueIds.size} duplicates on this page!`);
        }
      } else {
        console.log(`   ℹ️  No models returned (end of data)`);
      }

    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(70));

  // Test requesting all at once
  console.log('\n📡 Testing single request with limit=50000...');
  try {
    const response = await fetch(
      'https://api.gatewayz.ai/v1/models?gateway=huggingface&limit=50000',
      { signal: AbortSignal.timeout(60000) }
    );

    if (response.ok) {
      const data = await response.json();
      const models = data.data || [];
      const uniqueIds = new Set(models.map(m => m.id));

      console.log(`   Total models returned: ${models.length}`);
      console.log(`   Unique model IDs: ${uniqueIds.size}`);
      console.log(`   Duplicate entries: ${models.length - uniqueIds.size}`);

      if (models.length !== uniqueIds.size) {
        console.log(`   ⚠️  BACKEND BUG: Returning duplicates!`);
      } else if (models.length < 1000) {
        console.log(`   ⚠️  BACKEND ISSUE: Only ${models.length} models (expected ~1350+)`);
      } else {
        console.log(`   ✅ Backend working correctly!`);
      }
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }

  console.log('\n' + '='.repeat(70));
}

testPagination().catch(console.error);
