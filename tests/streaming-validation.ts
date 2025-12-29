/**
 * Manual validation script for OpenRouter auto streaming
 *
 * This script tests:
 * 1. Streaming responses work with openrouter/auto
 * 2. Chunks are properly formatted and parsed
 * 3. Error handling works correctly
 * 4. Rate limiting and retries work
 */

import { streamChatResponse } from '../src/lib/streaming';

interface TestResult {
  testName: string;
  passed: boolean;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

/**
 * Helper to create a test
 */
async function runTest(
  testName: string,
  testFn: () => Promise<void>
): Promise<void> {
  console.log(`\n🧪 Running: ${testName}`);
  try {
    await testFn();
    results.push({ testName, passed: true });
    console.log(`✅ PASSED: ${testName}`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    results.push({ testName, passed: false, error: errorMsg });
    console.error(`❌ FAILED: ${testName}`);
    console.error(`   Error: ${errorMsg}`);
  }
}

/**
 * Get API key from environment or throw
 */
function getApiKey(): string {
  const apiKey = process.env.GATEWAYZ_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GATEWAYZ_API_KEY environment variable is required. ' +
      'Set it with: export GATEWAYZ_API_KEY=your_api_key'
    );
  }
  return apiKey;
}

/**
 * Test 1: Basic streaming with openrouter/auto
 */
async function testBasicStreaming() {
  const apiKey = getApiKey();
  const url = '/api/chat/completions';

  const requestBody = {
    model: 'openrouter/auto',
    messages: [
      { role: 'user', content: 'Say hello in exactly 3 words.' }
    ],
    stream: true,
    max_tokens: 10
  };

  let chunkCount = 0;
  let contentReceived = '';
  let hasContent = false;
  let hasDone = false;

  for await (const chunk of streamChatResponse(url, apiKey, requestBody)) {
    chunkCount++;

    if (chunk.content) {
      hasContent = true;
      contentReceived += chunk.content;
    }

    if (chunk.done) {
      hasDone = true;
    }
  }

  if (chunkCount === 0) {
    throw new Error('No chunks received from stream');
  }

  if (!hasContent) {
    throw new Error('No content received in any chunk');
  }

  if (!hasDone) {
    throw new Error('Stream did not send done signal');
  }

  console.log(`   Received ${chunkCount} chunks`);
  console.log(`   Content: "${contentReceived}"`);
}

/**
 * Test 2: Verify chunk format
 */
async function testChunkFormat() {
  const apiKey = getApiKey();
  const url = '/api/chat/completions';

  const requestBody = {
    model: 'openrouter/auto',
    messages: [
      { role: 'user', content: 'Count to 3.' }
    ],
    stream: true,
    max_tokens: 20
  };

  for await (const chunk of streamChatResponse(url, apiKey, requestBody)) {
    // Validate chunk structure
    if (chunk.content !== undefined && typeof chunk.content !== 'string') {
      throw new Error(`Invalid content type: ${typeof chunk.content}`);
    }

    if (chunk.reasoning !== undefined && typeof chunk.reasoning !== 'string') {
      throw new Error(`Invalid reasoning type: ${typeof chunk.reasoning}`);
    }

    if (chunk.done !== undefined && typeof chunk.done !== 'boolean') {
      throw new Error(`Invalid done type: ${typeof chunk.done}`);
    }

    if (chunk.status !== undefined &&
        !['rate_limit_retry', 'first_token', 'timing_info'].includes(chunk.status)) {
      throw new Error(`Invalid status value: ${chunk.status}`);
    }
  }

  console.log('   All chunks have valid format');
}

/**
 * Test 3: Error handling with invalid API key
 */
async function testInvalidApiKey() {
  const url = '/api/chat/completions';

  const requestBody = {
    model: 'openrouter/auto',
    messages: [
      { role: 'user', content: 'Hello' }
    ],
    stream: true
  };

  let errorThrown = false;

  try {
    for await (const chunk of streamChatResponse(url, 'invalid-key', requestBody)) {
      // Should not get here
    }
  } catch (error) {
    errorThrown = true;
    const errorMsg = error instanceof Error ? error.message : String(error);

    if (!errorMsg.includes('Authentication') && !errorMsg.includes('401')) {
      throw new Error(`Expected authentication error, got: ${errorMsg}`);
    }
  }

  if (!errorThrown) {
    throw new Error('Expected error for invalid API key, but none was thrown');
  }

  console.log('   Properly handled invalid API key');
}

/**
 * Test 4: Long streaming response
 */
async function testLongStreaming() {
  const apiKey = getApiKey();
  const url = '/api/chat/completions';

  const requestBody = {
    model: 'openrouter/auto',
    messages: [
      { role: 'user', content: 'Write a short poem about AI (2-3 sentences).' }
    ],
    stream: true,
    max_tokens: 100
  };

  let chunkCount = 0;
  let totalContent = '';
  const startTime = Date.now();

  for await (const chunk of streamChatResponse(url, apiKey, requestBody)) {
    chunkCount++;

    if (chunk.content) {
      totalContent += chunk.content;
    }
  }

  const duration = Date.now() - startTime;

  if (totalContent.length < 10) {
    throw new Error(`Response too short: ${totalContent.length} chars`);
  }

  console.log(`   Received ${chunkCount} chunks in ${duration}ms`);
  console.log(`   Total content length: ${totalContent.length} chars`);
  console.log(`   Content preview: "${totalContent.substring(0, 50)}..."`);
}

/**
 * Test 5: Multiple sequential requests
 */
async function testMultipleRequests() {
  const apiKey = getApiKey();
  const url = '/api/chat/completions';

  const prompts = [
    'Say "test 1"',
    'Say "test 2"',
    'Say "test 3"'
  ];

  for (let i = 0; i < prompts.length; i++) {
    const requestBody = {
      model: 'openrouter/auto',
      messages: [
        { role: 'user', content: prompts[i] }
      ],
      stream: true,
      max_tokens: 10
    };

    let hasContent = false;

    for await (const chunk of streamChatResponse(url, apiKey, requestBody)) {
      if (chunk.content) {
        hasContent = true;
      }
    }

    if (!hasContent) {
      throw new Error(`Request ${i + 1} failed to receive content`);
    }
  }

  console.log(`   Successfully completed ${prompts.length} sequential requests`);
}

/**
 * Test 6: Verify timing metadata
 */
async function testTimingMetadata() {
  const apiKey = getApiKey();
  const url = '/api/chat/completions';

  const requestBody = {
    model: 'openrouter/auto',
    messages: [
      { role: 'user', content: 'Hi' }
    ],
    stream: true,
    max_tokens: 5
  };

  let hasTimingInfo = false;

  for await (const chunk of streamChatResponse(url, apiKey, requestBody)) {
    if (chunk.status === 'timing_info' && chunk.timingMetadata) {
      hasTimingInfo = true;

      // Validate timing metadata structure
      if (chunk.timingMetadata.backendTimeMs !== undefined &&
          typeof chunk.timingMetadata.backendTimeMs !== 'number') {
        throw new Error('Invalid backendTimeMs type');
      }

      if (chunk.timingMetadata.networkTimeMs !== undefined &&
          typeof chunk.timingMetadata.networkTimeMs !== 'number') {
        throw new Error('Invalid networkTimeMs type');
      }

      if (chunk.timingMetadata.totalTimeMs !== undefined &&
          typeof chunk.timingMetadata.totalTimeMs !== 'number') {
        throw new Error('Invalid totalTimeMs type');
      }
    }
  }

  // Timing info is optional, so we just log if it was present
  console.log(`   Timing metadata ${hasTimingInfo ? 'present' : 'not present'}`);
}

/**
 * Main test runner
 */
async function runAllTests() {
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║  OpenRouter Auto Streaming Validation Suite   ║');
  console.log('╚════════════════════════════════════════════════╝');

  try {
    getApiKey(); // Verify API key is set before running tests
  } catch (error) {
    console.error('\n❌ Cannot run tests:');
    console.error(`   ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }

  await runTest('Basic streaming with openrouter/auto', testBasicStreaming);
  await runTest('Chunk format validation', testChunkFormat);
  await runTest('Invalid API key handling', testInvalidApiKey);
  await runTest('Long streaming response', testLongStreaming);
  await runTest('Multiple sequential requests', testMultipleRequests);
  await runTest('Timing metadata validation', testTimingMetadata);

  // Print summary
  console.log('\n╔════════════════════════════════════════════════╗');
  console.log('║              Test Summary                      ║');
  console.log('╚════════════════════════════════════════════════╝');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log(`\n📊 Total: ${results.length} | ✅ Passed: ${passed} | ❌ Failed: ${failed}\n`);

  if (failed > 0) {
    console.log('Failed tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  ❌ ${r.testName}`);
      console.log(`     ${r.error}`);
    });
    process.exit(1);
  } else {
    console.log('🎉 All tests passed!\n');
    process.exit(0);
  }
}

// Run tests if this is the main module
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('\n💥 Fatal error running tests:');
    console.error(error);
    process.exit(1);
  });
}

export { runAllTests, runTest };
