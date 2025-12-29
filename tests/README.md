# Manual Validation Tests

This directory contains manual validation scripts for testing specific features with real API endpoints.

## Available Tests

### Streaming Validation (`streaming-validation.ts`)

Validates that streaming works correctly with OpenRouter auto and other models.

**Setup:**
```bash
export GATEWAYZ_API_KEY=your_actual_api_key
```

**Run:**
```bash
tsx tests/streaming-validation.ts
```

**What it tests:**
1. Basic streaming with openrouter/auto
2. Chunk format validation
3. Invalid API key handling
4. Long streaming responses
5. Multiple sequential requests
6. Timing metadata
7. Rate limit retry logic

**Expected output:**
```
╔════════════════════════════════════════════════╗
║  OpenRouter Auto Streaming Validation Suite   ║
╚════════════════════════════════════════════════╝

🧪 Running: Basic streaming with openrouter/auto
   Received 5 chunks
   Content: "Hello, how can I help you?"
✅ PASSED: Basic streaming with openrouter/auto

🧪 Running: Chunk format validation
   All chunks have valid format
✅ PASSED: Chunk format validation

...

╔════════════════════════════════════════════════╗
║              Test Summary                      ║
╚════════════════════════════════════════════════╝

📊 Total: 6 | ✅ Passed: 6 | ❌ Failed: 0

🎉 All tests passed!
```

## When to Use Manual Tests

Use these tests when:
- Testing with real API endpoints
- Validating actual streaming behavior
- Debugging production issues
- Verifying rate limiting works correctly
- Testing with specific API keys/tiers

## Automated Tests

For automated testing, use:
- **Unit tests:** `pnpm test`
- **E2E tests:** `pnpm test:e2e`

See `docs/OPENROUTER_AUTO_STREAMING_TESTS.md` for complete testing documentation.
