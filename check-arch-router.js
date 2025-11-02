async function checkArchRouter() {
  console.log('🔍 Checking for Arch-Router model in HuggingFace...\n');

  try {
    const response = await fetch(
      'https://api.gatewayz.ai/v1/models?gateway=huggingface&limit=200',
      { signal: AbortSignal.timeout(30000) }
    );

    const data = await response.json();
    const models = data.data || [];

    console.log(`Total HuggingFace models: ${models.length}\n`);

    // Look for Arch-Router
    const archRouter = models.find(m => m.id.includes('Arch-Router') || m.id.includes('arch-router'));

    if (archRouter) {
      console.log('✅ Arch-Router FOUND:');
      console.log('   ID:', archRouter.id);
      console.log('   Name:', archRouter.name);
      console.log('   Description:', archRouter.description?.substring(0, 100));
    } else {
      console.log('❌ Arch-Router NOT FOUND in HuggingFace models');
      console.log('\nFirst 10 model IDs:');
      models.slice(0, 10).forEach((m, i) => {
        console.log(`   ${i + 1}. ${m.id}`);
      });
    }

    // Try calling the chat API anyway
    console.log('\n📡 Testing chat completions API call...');
    const chatResponse = await fetch('https://api.gatewayz.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer gw_live_XqCdiy8pusbJarbOV94x_sIB67b4GyHzmKz5XiIcxd8'
      },
      body: JSON.stringify({
        model: 'katanemo/Arch-Router-1.5B',
        messages: [{
          role: 'user',
          content: 'Hello! What can you help me with?'
        }]
      }),
      signal: AbortSignal.timeout(30000)
    });

    console.log('   Response status:', chatResponse.status);
    const responseText = await chatResponse.text();
    console.log('   Response (first 500 chars):', responseText.substring(0, 500));

    try {
      const chatData = JSON.parse(responseText);
      console.log('   Parsed JSON:', JSON.stringify(chatData, null, 2));
    } catch (e) {
      console.log('   ❌ Not JSON - likely an HTML error page');
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkArchRouter();
