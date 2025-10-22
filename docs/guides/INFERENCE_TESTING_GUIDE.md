# Model Inference Testing Framework

## Overview

This document describes the model inference testing framework for validating that each model successfully delivers inference results through their respective gateways.

## Test Frameworks

We've created two testing approaches to suit different needs:

### 1. **test_model_inference.py** - Direct Function Testing
Tests gateway client functions directly without HTTP overhead.

**Pros:**
- Fast execution
- Direct error feedback from clients
- Good for debugging client code

**Cons:**
- Doesn't test full HTTP pipeline
- Requires all client dependencies
- Not realistic for production scenarios

**Usage:**
```bash
python test_model_inference.py
```

### 2. **test_model_inference_v2.py** - API Endpoint Testing (RECOMMENDED)
Tests models through actual HTTP API endpoints (`/v1/chat/completions`).

**Pros:**
- Tests full request/response pipeline
- Realistic production scenario
- Works even if some clients missing
- Tests authentication, routing, and error handling

**Cons:**
- Requires running backend server
- Slower due to HTTP overhead
- Depends on API availability

**Usage:**
```bash
# Start backend first
python -m uvicorn src.main:app --reload

# In another terminal, run tests
python test_model_inference_v2.py
```

**With custom configuration:**
```bash
GATEWAYZ_API_URL=http://localhost:8000 \
GATEWAYZ_API_KEY=your-api-key \
python test_model_inference_v2.py
```

## Test Coverage

### Currently Testable Gateways (7/13)
- ✓ OpenRouter
- ✓ Portkey
- ✓ Featherless
- ✓ Fireworks
- ✓ Together
- ✓ Google (via Portkey)
- ✓ Cerebras (via Portkey)
- ✓ Nebius (via Portkey)
- ✓ Xai (via Portkey)
- ✓ Novita (via Portkey)
- ✓ Hugging Face (via Portkey)

### Not Yet Testable (2/13)
- ✗ Chutes (no inference client implemented)
- ✗ Groq (no inference client implemented)
- ✗ DeepInfra (authentication issues)

## Test Configuration

Default configuration in both test scripts:

```python
TEST_CONFIG = {
    'max_models_per_gateway': 3,  # Test top 3 models per gateway
    'timeout_seconds': 30,         # Request timeout
    'test_message': 'Respond with: "Test successful"',
    'max_tokens': 50,
    'temperature': 0.7,
}
```

Modify these values at the top of either test script.

## Expected Results

### Success Criteria
- **HTTP Status 200** with valid JSON response
- **Valid message content** in response choices
- **Response time < 30 seconds** (configurable)

### Common Failure Reasons

| Error | Cause | Solution |
|-------|-------|----------|
| 401 Unauthorized | Invalid/missing API key | Check `GATEWAYZ_API_KEY` env var |
| 404 Not Found | Model not available on provider | Model may not exist or user has no access |
| 400 Bad Request | Invalid request parameters | Check model ID format for gateway |
| 429 Rate Limited | Too many requests | Add delays between requests |
| 500 Server Error | Backend error | Check backend logs |
| 503 Service Unavailable | Upstream service down | Gateway may be experiencing issues |
| Timeout | Request took > 30s | Increase timeout or check network |

## Model ID Formats

Different gateways expect different model ID formats:

### OpenRouter
```
openai/gpt-4
anthropic/claude-3-sonnet
```

### Portkey
```
@openai/gpt-4
@anthropic/claude-3-sonnet
```

### Featherless
```
Mistral/Mistral-Large-Instruct-2407
meta-llama/Meta-Llama-3.1-8B
```

### Fireworks
```
accounts/fireworks/models/gpt-4
accounts/fireworks/models/llama-v3-8b-instruct
```

### Together
```
meta-llama/Llama-3-70b-chat-hf
mistralai/Mistral-7B-Instruct-v0.3
```

### New Providers (via Portkey)
```
@google/gemini-pro
@cerebras/qwen-3-coder-480b
@nebius/nvidia/llama-3.1-70b-instruct
@xai/grok-4
@novita/meta-llama/llama-3.3-70b-instruct
@huggingface/llava-1.5-7b
```

## Interpreting Test Output

### Example Output
```
==============================================================================
Testing Gateway: OPENROUTER
==============================================================================
Fetching models from openrouter...
Testing 3 models

[1/3] OpenAI: GPT-4                       ... [OK] (2.45s)
[2/3] Anthropic: Claude 3 Sonnet          ... [OK] (1.89s)
[3/3] Meta: Llama 3 70B Chat              ... [OK] (3.12s)

==============================================================================
TEST SUMMARY
==============================================================================

[OK] openrouter      :  3/ 3 passed (100.0%)
[OK] portkey         :  2/ 3 passed ( 66.7%)
[WARN] featherless   :  1/ 3 passed ( 33.3%)
[FAIL] fireworks     :  0/ 3 passed (  0.0%)

TOTAL: 6/12 models passed (50.0%)
==============================================================================
```

**Interpretation:**
- `[OK]` - All models passed for this gateway
- `[WARN]` - Some models passed, some failed
- `[FAIL]` - No models passed
- Response time shows how long each inference took

## Adding New Gateway Tests

To test a new gateway:

1. **Ensure inference client exists** in `src/services/{gateway_name}_client.py`
2. **Add to `GATEWAY_INFO` dict** in test script
3. **Update `TestableGateways` comment** in documentation
4. **Run tests** to verify

Example:
```python
GATEWAY_INFO = {
    'my_gateway': {
        'testable': True,
        'description': 'My Gateway Provider',
    },
}
```

## Continuous Integration

To add automated testing to CI/CD:

```yaml
# Example GitHub Actions workflow
- name: Test Model Inference
  env:
    GATEWAYZ_API_URL: http://localhost:8000
    GATEWAYZ_API_KEY: ${{ secrets.TEST_API_KEY }}
  run: |
    python -m pytest test_model_inference_v2.py -v
```

## Known Limitations

1. **Chutes & Groq** - No inference client yet, skipped in tests
2. **New Providers** - Use pattern-based filtering from Portkey unified catalog (integrations API requires workspace admin access)
3. **Rate Limiting** - Tests may hit rate limits with high concurrency
4. **Model Availability** - Some models may be region/access restricted
5. **Streaming** - v2 tests non-streaming only (easier to validate)
6. **Provider Integration Endpoints** - Portkey `/integrations/{slug}/models` requires admin workspace scoping

## Future Improvements

- [ ] Implement Chutes inference client
- [ ] Implement Groq inference client
- [ ] Add streaming response validation
- [ ] Parametrized test execution (different message types)
- [ ] Performance benchmarking per model
- [ ] Cache test results for analysis
- [ ] Integration with CI/CD pipeline
- [ ] Health check endpoint for quick status
- [ ] Per-model SLA tracking

## Troubleshooting

### "API is unreachable"
```bash
# Start the backend
cd /path/to/gatewayz-backend
python -m uvicorn src.main:app --reload --port 8000
```

### "401 Unauthorized"
```bash
# Set valid API key
export GATEWAYZ_API_KEY="your-valid-api-key"
python test_model_inference_v2.py
```

### "No models available"
```bash
# Check that /models endpoint is working
curl http://localhost:8000/models?gateway=openrouter \
  -H "Authorization: Bearer your-api-key"
```

### Tests timeout frequently
```bash
# Increase timeout in test script
TEST_CONFIG = {
    'timeout_seconds': 60,  # Increased from 30
    ...
}
```

## Contact & Support

For issues with:
- **Specific gateway** - Check gateway's API documentation
- **Test framework** - Review test output for error messages
- **Backend routing** - Check logs in `src/routes/chat.py`
- **Model availability** - Verify model exists via `/models` endpoint
