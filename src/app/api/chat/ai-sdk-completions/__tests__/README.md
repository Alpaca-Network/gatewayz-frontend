# AI SDK Completions Route Tests

Comprehensive test suite for the AI SDK chat completions route to prevent regressions and ensure reliability.

## Test Coverage

### 1. Unit Tests (`route.test.ts`)
Tests core functionality and business logic:

- **Request Validation** (6 tests)
  - Missing messages array
  - Missing model parameter
  - Missing API key
  - API key from Authorization header
  - API key from request body

- **Provider Detection** (5 tests)
  - Claude model detection
  - OpenAI model detection
  - Google model detection
  - DeepSeek model detection
  - Fallback to gatewayz provider

- **Reasoning Detection** (16 tests)
  - Claude models with reasoning
  - OpenAI O1/O3 models
  - Gemini 2.0+ models
  - DeepSeek R1/Reasoner
  - Qwen QwQ models
  - Generic pattern matching

- **SSE Stream Formatting** (3 tests)
  - Text-delta SSE format
  - Reasoning-delta SSE format
  - Finish reason inclusion

- **Error Handling** (2 tests)
  - streamText errors
  - API key validation errors

- **OpenAI Provider Usage** (1 test)
  - Verifies all models use OpenAI provider

**Total: 33 unit tests**

### 2. Integration Tests (`streaming.test.ts`)
Tests the complete streaming flow:

- **Complete Streaming Flow** (3 tests)
  - Multi-chunk text streaming
  - Reasoning and text separation
  - Interleaved reasoning and text

- **SSE Format Compliance** (2 tests)
  - Valid SSE format structure
  - Valid JSON in SSE messages

- **Error Streaming** (1 test)
  - Stream error handling

- **Performance** (1 test)
  - Large chunk handling (1000 chunks)

- **Multi-model Compatibility** (1 test)
  - Consistent format across providers

**Total: 8 integration tests**

### 3. Reasoning Detection Tests (`reasoning-detection.test.ts`)
Comprehensive reasoning capability detection:

- **Claude Models** (10 tests)
  - 3.7 Sonnet variants
  - Opus 4 variants
  - Sonnet 4 variants
  - Non-reasoning models

- **OpenAI Models** (9 tests)
  - O1 variants
  - O3 variants
  - GPT-4 variants

- **Google Models** (7 tests)
  - Gemini 2.0 variants
  - Experimental models
  - Non-reasoning models

- **DeepSeek Models** (5 tests)
  - R1 variants
  - Reasoner variants
  - Non-reasoning models

- **Qwen Models** (5 tests)
  - QwQ variants
  - Thinking modes
  - Non-reasoning models

- **Generic Pattern Matching** (8 tests)
  - "thinking" keyword
  - "reasoning" keyword
  - "reflection" keyword
  - "chain-of-thought" keyword
  - "COT" suffix

- **Case Insensitivity** (9 tests)
  - Various case combinations

- **Edge Cases** (3 tests)
  - Empty model names
  - Special characters
  - Version suffixes

**Total: 56 reasoning tests**

### 4. E2E Tests (`/e2e/chat-ai-sdk.spec.ts`)
User flow and UI integration:

- **Basic Chat Functionality** (3 tests)
  - Send and receive messages
  - Streaming indicator
  - Multi-model support

- **Reasoning Display** (2 tests)
  - Claude 3.7 Sonnet reasoning
  - O1 model reasoning

- **Error Handling** (2 tests)
  - Invalid API key
  - Network errors

- **Session Management** (1 test)
  - Conversation history

- **Console Logging** (1 test)
  - Route usage logging

**Total: 9 E2E tests**

## Total Test Count

- **106 tests** across 4 test files
- **3 test types**: Unit, Integration, E2E
- **Coverage areas**: Validation, Provider Detection, Reasoning, Streaming, Errors, UI

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Specific Test Suite
```bash
# Unit tests
npm test route.test.ts

# Integration tests
npm test streaming.test.ts

# Reasoning detection tests
npm test reasoning-detection.test.ts

# E2E tests
npm run test:e2e chat-ai-sdk.spec.ts
```

### Run Tests in Watch Mode
```bash
npm test -- --watch
```

### Run with Coverage
```bash
npm test -- --coverage
```

## Test Strategy

### Prevention Focus
These tests specifically prevent the "Internal Server Error" issue that occurred when:
- Provider-specific SDKs sent native format requests
- Gatewayz backend expected OpenAI-compatible format

### Key Protections

1. **OpenAI Provider Verification**
   - Test ensures all models use OpenAI provider
   - Prevents use of Anthropic/Google SDKs directly

2. **SSE Format Validation**
   - Validates OpenAI-compatible SSE structure
   - Ensures `choices[0].delta.content` format

3. **Reasoning Detection Coverage**
   - 56 tests covering all known reasoning models
   - Ensures no regression in reasoning support

4. **Multi-Provider Compatibility**
   - Tests all provider models produce same format
   - Prevents provider-specific bugs

## CI/CD Integration

Tests run automatically on:
- Every PR
- Every push to main branch
- Pre-deployment checks

### Required Passing Tests
All 106 tests must pass before:
- Merging PRs
- Deploying to production
- Releasing new versions

## Maintenance

### Adding New Models
When adding new reasoning models:
1. Add test case to `reasoning-detection.test.ts`
2. Verify reasoning detection works
3. Update documentation

### Adding New Providers
When adding new providers:
1. Add provider detection test to `route.test.ts`
2. Add streaming format test to `streaming.test.ts`
3. Verify OpenAI provider usage

### Test Failures
If tests fail:
1. Check for API changes in AI SDK
2. Verify Gatewayz backend compatibility
3. Review provider detection logic
4. Check SSE format requirements

## Known Limitations

- E2E tests require actual API access
- Some tests use mocks (not real AI SDK calls)
- Reasoning display tests require specific models to be available

## Future Improvements

- [ ] Add load testing for high-volume scenarios
- [ ] Add tests for token counting
- [ ] Add tests for rate limiting
- [ ] Add tests for concurrent requests
- [ ] Add visual regression tests for reasoning display
