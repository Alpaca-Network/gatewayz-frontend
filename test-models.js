const https = require('https');

const API_KEY = 'gw_live_hMdf3qaEzGnM1l3164lMjE0Q6pHVgKfmAoQEBgD67OA';
const API_URL = 'https://api.gatewayz.ai/v1/chat/completions';

// Top models to test from rankings
const modelsToTest = [
  'x-ai/grok-code-fast-1',
  'anthropic/claude-sonnet-4.5',
  'anthropic/claude-sonnet-4',
  'google/gemini-2.5-flash',
  'google/gemini-2.5-pro',
  'openai/gpt-5',
  'openai/gpt-4o',
  'deepseek/deepseek-chat',
  'qwen/qwen-3-5-236b',
  'meta-llama/llama-3.3-70b'
];

function testModel(modelId) {
  return new Promise((resolve) => {
    const postData = JSON.stringify({
      model: modelId,
      messages: [
        {
          role: 'user',
          content: 'Say "Hello, I am working!" in exactly those words.'
        }
      ],
      max_tokens: 50
    });

    const options = {
      hostname: 'api.gatewayz.ai',
      port: 443,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 30000
    };

    const startTime = Date.now();

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const responseTime = Date.now() - startTime;

        try {
          const parsed = JSON.parse(data);

          if (res.statusCode === 200 && parsed.choices && parsed.choices[0]) {
            resolve({
              model: modelId,
              status: 'success',
              statusCode: res.statusCode,
              responseTime: `${responseTime}ms`,
              response: parsed.choices[0].message.content.substring(0, 100),
              usage: parsed.usage || null
            });
          } else {
            resolve({
              model: modelId,
              status: 'failed',
              statusCode: res.statusCode,
              responseTime: `${responseTime}ms`,
              error: parsed.error?.message || parsed.detail || 'Unknown error',
              rawResponse: data.substring(0, 200)
            });
          }
        } catch (e) {
          resolve({
            model: modelId,
            status: 'failed',
            statusCode: res.statusCode,
            responseTime: `${responseTime}ms`,
            error: 'Failed to parse response',
            rawResponse: data.substring(0, 200)
          });
        }
      });
    });

    req.on('error', (e) => {
      resolve({
        model: modelId,
        status: 'error',
        error: e.message,
        responseTime: `${Date.now() - startTime}ms`
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        model: modelId,
        status: 'timeout',
        error: 'Request timed out after 30 seconds',
        responseTime: '30000ms+'
      });
    });

    req.write(postData);
    req.end();
  });
}

async function testAllModels() {
  console.log('Starting model tests...\n');
  console.log('='.repeat(80));

  const results = [];

  for (const model of modelsToTest) {
    console.log(`\nTesting: ${model}`);
    const result = await testModel(model);
    results.push(result);

    if (result.status === 'success') {
      console.log(`✓ SUCCESS - ${result.responseTime} - ${result.response.substring(0, 50)}...`);
    } else {
      console.log(`✗ FAILED - ${result.error || 'Unknown error'}`);
    }

    // Wait 1 second between requests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n' + '='.repeat(80));
  console.log('\nTEST SUMMARY');
  console.log('='.repeat(80));

  const successCount = results.filter(r => r.status === 'success').length;
  const failedCount = results.filter(r => r.status === 'failed').length;
  const errorCount = results.filter(r => r.status === 'error').length;
  const timeoutCount = results.filter(r => r.status === 'timeout').length;

  console.log(`\nTotal Models Tested: ${results.length}`);
  console.log(`✓ Successful: ${successCount} (${((successCount/results.length)*100).toFixed(1)}%)`);
  console.log(`✗ Failed: ${failedCount} (${((failedCount/results.length)*100).toFixed(1)}%)`);
  console.log(`⚠ Errors: ${errorCount} (${((errorCount/results.length)*100).toFixed(1)}%)`);
  console.log(`⏱ Timeouts: ${timeoutCount} (${((timeoutCount/results.length)*100).toFixed(1)}%)`);

  console.log('\n' + '='.repeat(80));
  console.log('\nDETAILED RESULTS');
  console.log('='.repeat(80));

  results.forEach((result, index) => {
    console.log(`\n${index + 1}. ${result.model}`);
    console.log(`   Status: ${result.status.toUpperCase()}`);
    console.log(`   Status Code: ${result.statusCode || 'N/A'}`);
    console.log(`   Response Time: ${result.responseTime}`);

    if (result.status === 'success') {
      console.log(`   Response: ${result.response}`);
      if (result.usage) {
        console.log(`   Tokens Used: ${result.usage.total_tokens || 'N/A'}`);
      }
    } else {
      console.log(`   Error: ${result.error || 'Unknown'}`);
      if (result.rawResponse) {
        console.log(`   Raw Response: ${result.rawResponse}`);
      }
    }
  });

  console.log('\n' + '='.repeat(80));
}

testAllModels().catch(console.error);
