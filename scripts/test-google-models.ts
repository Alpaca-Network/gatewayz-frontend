#!/usr/bin/env npx tsx
/**
 * Test script for Google Gemini models via the Gatewayz API
 *
 * Usage:
 *   npx tsx scripts/test-google-models.ts
 *
 * Or with specific API key:
 *   GATEWAYZ_API_KEY=your-key npx tsx scripts/test-google-models.ts
 */

const GATEWAYZ_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.gatewayz.ai';
const GATEWAYZ_API_KEY = process.env.GATEWAYZ_API_KEY || process.env.API_KEY;

interface TestResult {
  model: string;
  success: boolean;
  response?: string;
  error?: string;
  latencyMs?: number;
}

const GOOGLE_MODELS_TO_TEST = [
  // Latest Google models via OpenRouter
  'openrouter/google/gemini-2.5-flash',      // Latest 2.5 Flash
  'openrouter/google/gemini-2.5-pro',        // Latest 2.5 Pro
  'openrouter/google/gemini-2.0-flash-001',  // 2.0 Flash stable
  'openrouter/google/gemini-2.0-flash-exp:free', // 2.0 Flash experimental (free)
  'openrouter/google/gemma-2-9b-it',         // Gemma 2 9B
  'openrouter/google/gemma-3-27b-it:free',   // Gemma 3 27B (free)
];

async function testModel(model: string): Promise<TestResult> {
  const startTime = Date.now();

  try {
    console.log(`\n📍 Testing model: ${model}`);

    const response = await fetch(`${GATEWAYZ_API_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GATEWAYZ_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'user', content: 'Say "Hello from Gatewayz!" in one short sentence.' }
        ],
        max_tokens: 100,
        stream: false,
      }),
    });

    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`   ❌ Error (${response.status}): ${errorText.substring(0, 200)}`);
      return {
        model,
        success: false,
        error: `HTTP ${response.status}: ${errorText.substring(0, 200)}`,
        latencyMs,
      };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    // Treat empty or missing content as a failure
    if (!content) {
      console.log(`   ❌ Error: No content in response`);
      return {
        model,
        success: false,
        error: 'No content in response',
        latencyMs,
      };
    }

    console.log(`   ✅ Success (${latencyMs}ms)`);
    console.log(`   📝 Response: "${content.substring(0, 100)}${content.length > 100 ? '...' : ''}"`);

    return {
      model,
      success: true,
      response: content,
      latencyMs,
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log(`   ❌ Exception: ${errorMessage}`);
    return {
      model,
      success: false,
      error: errorMessage,
      latencyMs,
    };
  }
}

async function testStreamingModel(model: string): Promise<TestResult> {
  const startTime = Date.now();

  try {
    console.log(`\n📍 Testing streaming: ${model}`);

    const response = await fetch(`${GATEWAYZ_API_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GATEWAYZ_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'user', content: 'Count from 1 to 5.' }
        ],
        max_tokens: 50,
        stream: true,
      }),
    });

    if (!response.ok) {
      const latencyMs = Date.now() - startTime;
      const errorText = await response.text();
      console.log(`   ❌ Error (${response.status}): ${errorText.substring(0, 200)}`);
      return {
        model: `${model} (streaming)`,
        success: false,
        error: `HTTP ${response.status}: ${errorText.substring(0, 200)}`,
        latencyMs,
      };
    }

    // Read streaming response
    const reader = response.body?.getReader();
    if (!reader) {
      return {
        model: `${model} (streaming)`,
        success: false,
        error: 'No response body',
        latencyMs: Date.now() - startTime,
      };
    }

    const decoder = new TextDecoder();
    let fullContent = '';
    let firstChunkTime: number | null = null;
    let chunkCount = 0;
    let buffer = ''; // Buffer for incomplete SSE lines across chunks

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      if (!firstChunkTime) {
        firstChunkTime = Date.now();
      }

      // Use stream: true to handle multi-byte UTF-8 characters split across chunks
      const chunk = decoder.decode(value, { stream: true });
      chunkCount++;

      // Parse SSE data with proper buffering for lines that span chunk boundaries
      buffer += chunk;
      const lines = buffer.split('\n');
      // Keep the last potentially incomplete line in the buffer
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const payload = line.slice(6).trim();
          // Check for exact [DONE] marker, not substring match
          if (payload === '[DONE]') {
            continue;
          }
          try {
            const data = JSON.parse(payload);
            const content = data.choices?.[0]?.delta?.content;
            if (content) {
              fullContent += content;
            }
          } catch {
            // Skip malformed JSON (can happen with partial data)
          }
        }
      }
    }

    // Process any remaining data in the buffer
    if (buffer.startsWith('data: ')) {
      const payload = buffer.slice(6).trim();
      // Check for exact [DONE] marker, not substring match
      if (payload !== '[DONE]') {
        try {
          const data = JSON.parse(payload);
          const content = data.choices?.[0]?.delta?.content;
          if (content) {
            fullContent += content;
          }
        } catch {
          // Skip malformed JSON
        }
      }
    }

    const latencyMs = Date.now() - startTime;
    const ttfb = firstChunkTime ? firstChunkTime - startTime : latencyMs;

    // Treat empty or missing content as a failure (consistent with non-streaming test)
    if (!fullContent) {
      console.log(`   ❌ Error: No content in streaming response (${chunkCount} chunks received)`);
      return {
        model: `${model} (streaming)`,
        success: false,
        error: 'No content in streaming response',
        latencyMs,
      };
    }

    console.log(`   ✅ Success (${latencyMs}ms total, ${ttfb}ms to first chunk, ${chunkCount} chunks)`);
    console.log(`   📝 Response: "${fullContent.substring(0, 100)}${fullContent.length > 100 ? '...' : ''}"`);

    return {
      model: `${model} (streaming)`,
      success: true,
      response: fullContent,
      latencyMs,
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log(`   ❌ Exception: ${errorMessage}`);
    return {
      model: `${model} (streaming)`,
      success: false,
      error: errorMessage,
      latencyMs,
    };
  }
}

async function main() {
  console.log('🚀 Google Models Test Suite');
  console.log('=============================\n');
  console.log(`API Base URL: ${GATEWAYZ_API_BASE_URL}`);
  console.log(`API Key: ${GATEWAYZ_API_KEY ? `${GATEWAYZ_API_KEY.substring(0, 10)}...` : '❌ NOT SET'}`);

  if (!GATEWAYZ_API_KEY) {
    console.error('\n❌ Error: No API key provided.');
    console.log('Please set GATEWAYZ_API_KEY or API_KEY environment variable.');
    console.log('Example: GATEWAYZ_API_KEY=your-key npx tsx scripts/test-google-models.ts');
    process.exit(1);
  }

  const results: TestResult[] = [];

  // Test non-streaming first
  console.log('\n\n📋 NON-STREAMING TESTS');
  console.log('----------------------');

  for (const model of GOOGLE_MODELS_TO_TEST) {
    const result = await testModel(model);
    results.push(result);
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Test streaming
  console.log('\n\n📋 STREAMING TESTS');
  console.log('------------------');

  // Test streaming with a working OpenRouter model
  const streamResult = await testStreamingModel('openrouter/google/gemini-2.0-flash-001');
  results.push(streamResult);

  // Summary
  console.log('\n\n📊 SUMMARY');
  console.log('==========\n');

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`Total tests: ${results.length}`);
  console.log(`✅ Passed: ${successful}`);
  console.log(`❌ Failed: ${failed}`);

  if (failed > 0) {
    console.log('\nFailed tests:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`  - ${r.model}: ${r.error}`);
    });
  }

  console.log('\nLatency breakdown:');
  results.forEach(r => {
    const status = r.success ? '✅' : '❌';
    console.log(`  ${status} ${r.model}: ${r.latencyMs}ms`);
  });

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(console.error);
