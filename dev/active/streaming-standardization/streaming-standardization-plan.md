# Backend Streaming Standardization Plan

## Executive Summary

This plan outlines the architecture and implementation steps for standardizing model output on the **Gatewayz backend** so that streaming works reliably for all 60+ providers. The goal is to ensure that regardless of the underlying provider's response format, the frontend receives a consistent, well-structured stream of events that can be reliably parsed and displayed.

---

## Current State Analysis

### Problem Statement

The frontend receives streams from 60+ model providers via the Gatewayz backend. Currently, different providers return different streaming formats:

1. **OpenAI Chat Completions Format** - Standard `choices[].delta.content` structure
2. **OpenAI Responses API Format** - `output[]` array with `response.chunk` objects (Fireworks, direct DeepSeek)
3. **Anthropic Format** - `content_block_delta` events with nested structures
4. **Google/Gemini Format** - `candidates[]` with `content.parts[]`
5. **Custom Provider Formats** - Various proprietary structures

### Current Architecture

```
┌────────────────┐     ┌─────────────────────┐     ┌──────────────────┐
│   Frontend     │────▶│  Next.js API Route  │────▶│ Gatewayz Backend │
│  streaming.ts  │◀────│  (ai-sdk-completions)│◀────│    (Python)      │
└────────────────┘     └─────────────────────┘     └──────────────────┘
                                │                           │
                                │ AI SDK streamText()       │ 60+ Providers
                                │ expects OpenAI format     │ various formats
                                │                           │
                                ▼                           ▼
                       ┌─────────────────┐         ┌──────────────────┐
                       │ SSE Translation │         │ Format Varies:   │
                       │ text-delta →    │         │ - OpenAI         │
                       │ content         │         │ - Responses API  │
                       └─────────────────┘         │ - Anthropic      │
                                                   │ - Gemini         │
                                                   │ - Custom         │
                                                   └──────────────────┘
```

### Current Frontend Workarounds

1. **Route Splitting**: `/api/chat/ai-sdk-completions/route.ts` uses AI SDK for most providers, but redirects Fireworks and direct DeepSeek to `/api/chat/completions/route.ts`
2. **Format Detection**: `streaming.ts` handles multiple formats (`choices[].delta`, `output[]`, event types)
3. **Reasoning Extraction**: Multiple field names checked (`reasoning_content`, `reasoning`, `thinking`, `analysis`, `inner_thought`, `thoughts`)

---

## Proposed Backend Standardization

### Target Output Format: OpenAI Chat Completions Streaming

The Gatewayz backend should normalize ALL provider responses to the OpenAI Chat Completions streaming format:

```typescript
// Standard SSE Event
interface StreamEvent {
  data: {
    id: string;                    // Unique completion ID
    object: "chat.completion.chunk";
    created: number;               // Unix timestamp
    model: string;                 // Actual model used
    choices: [{
      index: 0;
      delta: {
        role?: "assistant";        // First chunk only
        content?: string;          // Text content delta
        reasoning_content?: string; // Reasoning/thinking delta (standardized field)
      };
      finish_reason: null | "stop" | "length" | "error";
    }];
    // Optional: usage (final chunk)
    usage?: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
  }
}

// Done signal
"data: [DONE]\n\n"
```

### Key Standardization Rules

1. **Content Field**: Always use `delta.content` for main text
2. **Reasoning Field**: Always use `delta.reasoning_content` for chain-of-thought (not `reasoning`, `thinking`, etc.)
3. **Finish Reason**: Normalize to `stop`, `length`, or `error`
4. **Error Handling**: Return error in consistent format within stream, not as separate event type
5. **Usage Stats**: Include in final chunk when available

---

## Provider-Specific Normalization

### 1. OpenAI & Compatible Providers
- **Providers**: OpenAI, OpenRouter (most models), Together (OpenAI-routed)
- **Status**: Already compliant
- **Action**: Pass through unchanged

### 2. OpenAI Responses API Format
- **Providers**: Fireworks, Direct DeepSeek
- **Input Format**:
  ```json
  {
    "object": "response.chunk",
    "output": [{
      "delta": { "content": "..." },
      "finish_reason": null
    }]
  }
  ```
- **Normalization**: Transform `output[].delta` → `choices[].delta`

### 3. Anthropic Format
- **Providers**: Anthropic Claude (direct), Chutes (Claude models)
- **Input Format**:
  ```json
  {
    "type": "content_block_delta",
    "delta": { "type": "text_delta", "text": "..." }
  }
  ```
- **Extended Thinking Format**:
  ```json
  {
    "type": "content_block_delta",
    "delta": { "type": "thinking_delta", "thinking": "..." }
  }
  ```
- **Normalization**:
  - `text_delta` → `delta.content`
  - `thinking_delta` → `delta.reasoning_content`

### 4. Google Gemini Format
- **Providers**: Google (direct), Vercel AI Gateway (Gemini models)
- **Input Format**:
  ```json
  {
    "candidates": [{
      "content": {
        "parts": [{ "text": "..." }]
      }
    }]
  }
  ```
- **Normalization**: `candidates[0].content.parts[0].text` → `delta.content`

### 5. DeepSeek Reasoning Format
- **Providers**: DeepSeek R1 (via OpenRouter/Together/Groq)
- **Input Format**:
  ```json
  {
    "choices": [{
      "delta": {
        "content": "",
        "reasoning_content": "..."  // May also be "reasoning" or "thinking"
      }
    }]
  }
  ```
- **Normalization**: Standardize field to `reasoning_content`

### 6. Qwen QwQ/Thinking Models
- **Providers**: Alibaba (direct), OpenRouter, Together
- **Input Format**: Various (`thinking`, `inner_thought`, `thoughts`)
- **Normalization**: All → `delta.reasoning_content`

### 7. xAI Grok Format
- **Providers**: xAI (direct)
- **Input Format**: OpenAI-compatible but may have variations
- **Normalization**: Verify compliance, fix edge cases

### 8. Meta Llama Format
- **Providers**: Groq, Together, Fireworks, DeepInfra
- **Status**: Usually OpenAI-compatible through gateway
- **Action**: Verify no special handling needed

### 9. Mistral Format
- **Providers**: Mistral AI (direct), OpenRouter
- **Status**: OpenAI-compatible
- **Action**: Pass through unchanged

### 10. Hugging Face Inference
- **Providers**: Hugging Face
- **Input Format**: May vary by model
- **Normalization**: Handle text generation output format

---

## Implementation Phases

### Phase 1: Backend Normalization Layer (Backend Team)

Create a streaming response normalizer in the Gatewayz Python backend:

```python
# Proposed structure
class StreamNormalizer:
    """Normalizes provider streaming responses to OpenAI Chat Completions format"""

    def __init__(self, provider: str, model: str):
        self.provider = provider
        self.model = model
        self.normalizer = self._get_normalizer()

    def _get_normalizer(self) -> Callable:
        """Select appropriate normalizer based on provider/model"""
        normalizers = {
            'anthropic': self._normalize_anthropic,
            'google': self._normalize_gemini,
            'fireworks': self._normalize_responses_api,
            'deepseek': self._normalize_deepseek,
            # ... etc
        }
        return normalizers.get(self.provider, self._passthrough)

    async def normalize(self, chunk: dict) -> dict:
        """Transform provider chunk to standard format"""
        return self.normalizer(chunk)
```

**Deliverables**:
1. `StreamNormalizer` class with provider-specific methods
2. Integration into `/v1/chat/completions` streaming endpoint
3. Unit tests for each provider format
4. Integration tests with live provider streams

### Phase 2: Reasoning Content Standardization (Backend Team)

Standardize all reasoning/thinking fields to `reasoning_content`:

```python
REASONING_FIELD_ALIASES = [
    'reasoning_content',  # Target field
    'reasoning',
    'thinking',
    'analysis',
    'inner_thought',
    'thoughts',
    'reflection',
    'chain_of_thought',
]

def normalize_reasoning(delta: dict) -> dict:
    """Move any reasoning field to standard 'reasoning_content'"""
    for alias in REASONING_FIELD_ALIASES:
        if alias in delta and alias != 'reasoning_content':
            delta['reasoning_content'] = delta.pop(alias)
            break
    return delta
```

**Deliverables**:
1. Reasoning field normalization in StreamNormalizer
2. Model detection for reasoning capability
3. Documentation of reasoning-capable models

### Phase 3: Error Handling Standardization (Backend Team)

Normalize error responses within streams:

```python
def create_error_chunk(error_message: str, error_type: str = "provider_error") -> dict:
    """Create standardized error chunk"""
    return {
        "id": f"error-{uuid4()}",
        "object": "chat.completion.chunk",
        "created": int(time.time()),
        "model": self.model,
        "choices": [{
            "index": 0,
            "delta": {},
            "finish_reason": "error"
        }],
        "error": {
            "message": error_message,
            "type": error_type
        }
    }
```

**Deliverables**:
1. Error chunk format standardization
2. Provider error translation (rate limits, auth, etc.)
3. Graceful degradation for partial failures

### Phase 4: Frontend Simplification (Frontend Team - After Backend)

Once backend normalizes all streams, simplify frontend code:

1. **Remove format detection logic** from `streaming.ts`
2. **Remove route splitting** - all models use AI SDK route
3. **Simplify reasoning extraction** - only check `reasoning_content`
4. **Remove legacy format handlers**

---

## Detailed Provider Mapping

| Provider | Current Format | Normalization Required | Reasoning Support |
|----------|---------------|----------------------|-------------------|
| OpenAI | OpenAI Chat | None | o1, o3 models |
| Anthropic | Anthropic Events | Full | Claude 3.7+, 4+ |
| Google | Gemini Format | Full | Gemini 2.0 |
| DeepSeek | OpenAI + reasoning | reasoning field | R1 models |
| Fireworks | Responses API | Full | None |
| Together | OpenAI Chat | None | Via model |
| Groq | OpenAI Chat | None | Via model |
| OpenRouter | OpenAI Chat | None | Via model |
| xAI | OpenAI-like | Verify | Grok (TBD) |
| Mistral | OpenAI Chat | None | None |
| Hugging Face | Various | Model-specific | Model-specific |
| Qwen | OpenAI + variations | reasoning field | QwQ models |
| Chutes | Passes through | Inherits | Via model |
| DeepInfra | OpenAI Chat | None | Via model |
| Cerebras | OpenAI Chat | Verify | None |
| Novita | OpenAI Chat | Verify | Via model |
| Featherless | OpenAI Chat | Verify | Via model |
| NEAR | Custom | TBD | TBD |
| Alibaba | Custom/OpenAI | Verify | Qwen models |

---

## Testing Strategy

### Unit Tests

```python
# Test each provider normalizer
def test_anthropic_normalizer():
    input_chunk = {
        "type": "content_block_delta",
        "delta": {"type": "text_delta", "text": "Hello"}
    }
    output = normalizer.normalize(input_chunk)
    assert output["choices"][0]["delta"]["content"] == "Hello"

def test_reasoning_normalization():
    input_chunk = {
        "choices": [{
            "delta": {"thinking": "Let me analyze..."}
        }]
    }
    output = normalizer.normalize(input_chunk)
    assert output["choices"][0]["delta"]["reasoning_content"] == "Let me analyze..."
```

### Integration Tests

```python
@pytest.mark.parametrize("provider,model", [
    ("openai", "gpt-4o"),
    ("anthropic", "claude-3.7-sonnet"),
    ("google", "gemini-2.0-flash"),
    ("deepseek", "deepseek-r1"),
    ("fireworks", "accounts/fireworks/models/llama-v3p1-70b-instruct"),
])
async def test_streaming_normalization(provider, model):
    """Test that streaming output is normalized for each provider"""
    async for chunk in stream_completion(provider, model, "Hello"):
        # All chunks should have standard format
        assert "choices" in chunk
        assert chunk["choices"][0]["delta"] is not None
```

### E2E Tests

```typescript
// Frontend E2E test
test('streaming works for all providers', async ({ page }) => {
  const providers = ['openai', 'anthropic', 'google', 'deepseek'];

  for (const provider of providers) {
    await page.goto('/chat');
    await selectModel(page, `${provider}/test-model`);
    await sendMessage(page, 'Hello');
    await expect(page.locator('.assistant-message')).toContainText(/./);
  }
});
```

---

## Rollout Plan

### Stage 1: Development (Week 1-2)
- Implement StreamNormalizer class
- Add provider-specific normalizers
- Write unit tests
- Test with sandbox providers

### Stage 2: Staging (Week 3)
- Deploy to staging environment
- Run integration tests against all providers
- Test with real API keys
- Monitor for edge cases

### Stage 3: Canary (Week 4)
- Deploy to 5% of traffic
- Monitor error rates and latency
- Collect user feedback
- Fix any issues found

### Stage 4: Full Rollout (Week 5)
- Gradual rollout to 25%, 50%, 100%
- Monitor metrics at each stage
- Frontend cleanup after backend stable

---

## Success Metrics

1. **Stream Success Rate**: >99.5% of streams complete without errors
2. **Format Consistency**: 100% of chunks match standard format
3. **Reasoning Detection**: All reasoning-capable models return `reasoning_content`
4. **Latency Impact**: <5ms added latency for normalization
5. **Frontend Code Reduction**: 50%+ reduction in format handling code

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Provider format changes | Breaking changes | Version detection, feature flags |
| Normalization bugs | Corrupted output | Comprehensive test coverage |
| Performance impact | Increased latency | Efficient streaming transforms |
| Edge cases missed | Partial failures | Extensive provider testing |

---

## Dependencies

- **Backend Team**: Primary implementation
- **Frontend Team**: Testing and eventual cleanup
- **DevOps**: Staging/canary infrastructure
- **Provider Docs**: Format documentation for each

---

## Appendix: Current Frontend Format Handling Code (To Be Removed)

After backend standardization, the following frontend code becomes unnecessary:

### streaming.ts (Lines 616-806)
- Format detection for `output[]` array
- Event type handling (`response.output_text.delta`, etc.)
- Multiple reasoning field checks

### ai-sdk-completions/route.ts (Lines 284-352)
- Fireworks/DeepSeek redirect logic
- Provider format detection

### Total Frontend Code Reduction
- Estimated 400+ lines of format handling code
- Simpler, more maintainable streaming implementation
