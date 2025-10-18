async function testHFAPI() {
  console.log('Testing HuggingFace API endpoint...\n');

  try {
    // Test without parameters
    console.log('1️⃣ Testing: /v1/models?gateway=huggingface');
    const response1 = await fetch('https://api.gatewayz.ai/v1/models?gateway=huggingface', {
      signal: AbortSignal.timeout(60000)
    });
    console.log('   Status:', response1.status);

    if (response1.ok) {
      const data1 = await response1.json();
      console.log('   Models returned:', data1.data?.length || 0);
      if (data1.data?.length > 0) {
        console.log('   First model:', data1.data[0].id);
        const archRouter = data1.data.find(m => m.id.includes('Arch-Router'));
        if (archRouter) {
          console.log('   ✅ Arch-Router found:', archRouter.id);
        } else {
          console.log('   ❌ Arch-Router not found');
        }
      }
    } else {
      console.log('   ❌ Request failed:', await response1.text());
    }

    console.log('\n2️⃣ Testing: /v1/models?gateway=huggingface&limit=50000');
    const response2 = await fetch('https://api.gatewayz.ai/v1/models?gateway=huggingface&limit=50000', {
      signal: AbortSignal.timeout(60000)
    });
    console.log('   Status:', response2.status);

    if (response2.ok) {
      const data2 = await response2.json();
      console.log('   Models returned:', data2.data?.length || 0);
    } else {
      console.log('   ❌ Request failed');
    }

    console.log('\n3️⃣ Testing: /v1/models?gateway=hug (old slug)');
    const response3 = await fetch('https://api.gatewayz.ai/v1/models?gateway=hug', {
      signal: AbortSignal.timeout(60000)
    });
    console.log('   Status:', response3.status);

    if (response3.ok) {
      const data3 = await response3.json();
      console.log('   Models returned:', data3.data?.length || 0);
    } else {
      console.log('   ❌ Request failed');
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

testHFAPI().catch(console.error);
