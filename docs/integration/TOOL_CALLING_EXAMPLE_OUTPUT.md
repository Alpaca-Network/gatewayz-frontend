# Example Test Output

This document shows example outputs from running the tool calling tests.

## Simple Test (test-tool-calling-simple.ts)

### Successful Tool Call

```
$ GATEWAYZ_API_KEY="gw_..." pnpm tsx test-tool-calling-simple.ts

🧪 Testing Tool Calling with Qwen2 72B (FREE model)

Prompt: "What's the weather like in Tokyo?"

📋 Response:

{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1709876543,
  "model": "Qwen: Qwen2 72B A16B 2507",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": null,
        "tool_calls": [
          {
            "id": "call_xyz789",
            "type": "function",
            "function": {
              "name": "get_weather",
              "arguments": "{\"location\":\"Tokyo\"}"
            }
          }
        ]
      },
      "finish_reason": "tool_calls"
    }
  ],
  "usage": {
    "prompt_tokens": 125,
    "completion_tokens": 18,
    "total_tokens": 143
  }
}

✅ SUCCESS! Model called a tool:

Tool: get_weather
Arguments: {"location":"Tokyo"}

🎉 Tool calling is working!
```

### Model Does Not Call Tool

```
$ GATEWAYZ_API_KEY="gw_..." pnpm tsx test-tool-calling-simple.ts

🧪 Testing Tool Calling with Qwen2 72B (FREE model)

Prompt: "What's the weather like in Tokyo?"

📋 Response:

{
  "id": "chatcmpl-def456",
  "object": "chat.completion",
  "created": 1709876543,
  "model": "Qwen: Qwen2 72B A16B 2507",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "I don't have access to real-time weather data. To check the current weather in Tokyo, I recommend visiting a weather website or using a weather app."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 125,
    "completion_tokens": 35,
    "total_tokens": 160
  }
}

⚠️  Model did not call a tool
Response content: I don't have access to real-time weather data. To check the current weather in Tokyo, I recommend visiting a weather website or using a weather app.
```

---

## Full Test Suite (test-tool-calling.ts)

### List Models

```
$ pnpm tsx test-tool-calling.ts --list

Models with tool calling support:

1. GPT-4o mini
2. Qwen: Qwen2 72B A16B 2507
3. Qwen: Qwen2 57B A14B 2507
4. DeepSeek: DeepSeek V3.5
5. DeepSeek: DeepSeek V3 Reasoner
6. Google: Gemini 2.1 Pro
7. Google: Gemini 2.0 Flash Thinking Experimental
8. Anthropic: Claude 3.7 Sonnet
9. Meta: Llama 3.3 70B
```

### Test Specific Model

```
$ GATEWAYZ_API_KEY="gw_..." pnpm tsx test-tool-calling.ts "GPT-4o mini"

================================================================================
Testing: GPT-4o mini
Prompt: What's the weather like in San Francisco?
================================================================================

✅ Tool call successful!
Tool called: get_current_weather
Arguments: {
  "location": "San Francisco, CA",
  "unit": "fahrenheit"
}
Latency: 1247ms

Tool result: {"location":"San Francisco, CA","temperature":72,"unit":"fahrenheit","conditions":"Sunny","humidity":65}

Sending follow-up with tool result...

Final response:
The weather in San Francisco is currently sunny with a temperature of 72°F (22°C).
The humidity is at 65%, making it a pleasant day overall. It's a great time to be outdoors!

✨ Testing complete!
```

### Test with Math Calculation

```
$ GATEWAYZ_API_KEY="gw_..." pnpm tsx test-tool-calling.ts "Anthropic: Claude 3.7 Sonnet"

================================================================================
Testing: Anthropic: Claude 3.7 Sonnet
Prompt: What is 47 * 89 + 234?
================================================================================

✅ Tool call successful!
Tool called: calculate
Arguments: {
  "expression": "47 * 89 + 234"
}
Latency: 892ms

Tool result: {"result":4417}

Sending follow-up with tool result...

Final response:
The result of 47 × 89 + 234 is 4,417.

Here's how it breaks down:
- 47 × 89 = 4,183
- 4,183 + 234 = 4,417

✨ Testing complete!
```

### Failed Test (Insufficient Credits)

```
$ GATEWAYZ_API_KEY="gw_..." pnpm tsx test-tool-calling.ts "GPT-4o mini"

================================================================================
Testing: GPT-4o mini
Prompt: What's the weather like in San Francisco?
================================================================================

❌ FAILED
Error: Trial credits have been used up. You can still use FREE models! Look for models with the "FREE" badge in the model selector, or add credits to use premium models.
Latency: 456ms
```

### Rate Limit (Automatic Retry)

```
$ GATEWAYZ_API_KEY="gw_..." pnpm tsx test-tool-calling.ts "Google: Gemini 2.1 Pro"

================================================================================
Testing: Google: Gemini 2.1 Pro
Prompt: What's the weather like in San Francisco?
================================================================================

⏳ Rate limit hit, retrying in 2000ms (attempt 1/5)...

✅ Tool call successful!
Tool called: get_current_weather
Arguments: {
  "location": "San Francisco"
}
Latency: 3124ms

Tool result: {"location":"San Francisco","temperature":72,"unit":"fahrenheit","conditions":"Sunny","humidity":65}

Sending follow-up with tool result...

Final response:
The current weather in San Francisco is sunny with a temperature of 72°F and 65% humidity.

✨ Testing complete!
```

---

## curl Test (test-tool-calling-curl.sh)

### Successful Response

```
$ export GATEWAYZ_API_KEY="gw_..."
$ bash test-tool-calling-curl.sh

🧪 Testing Tool Calling with curl
API: https://api.gatewayz.ai
Model: Qwen: Qwen2 72B A16B 2507 (FREE)
Prompt: What's the weather like in Paris?

{
  "id": "chatcmpl-ghi789",
  "object": "chat.completion",
  "created": 1709876789,
  "model": "Qwen: Qwen2 72B A16B 2507",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": null,
        "tool_calls": [
          {
            "id": "call_abc123",
            "type": "function",
            "function": {
              "name": "get_weather",
              "arguments": "{\"location\":\"Paris\",\"unit\":\"celsius\"}"
            }
          }
        ]
      },
      "finish_reason": "tool_calls"
    }
  ],
  "usage": {
    "prompt_tokens": 142,
    "completion_tokens": 22,
    "total_tokens": 164
  }
}

✨ Done! Check the response above for tool_calls
```

---

## Common Error Messages

### Invalid API Key

```
❌ API Error: {
  "error": {
    "message": "Invalid API key",
    "type": "invalid_request_error"
  }
}
```

### Model Not Found

```
❌ API Error: {
  "detail": "Model not found: Invalid Model Name",
  "error": {
    "message": "Model not found"
  }
}
```

### Malformed Tool Definition

```
❌ API Error: {
  "error": {
    "message": "Invalid tool definition: 'parameters' must be an object with 'type': 'object'",
    "type": "invalid_request_error"
  }
}
```

### Network Error

```
❌ Error: Failed to fetch
Error: Could not connect to API server. Please check your network connection.
```

---

## Interpreting Results

### ✅ Success Indicators
- `✅ Tool call successful!` message
- `tool_calls` array present in response
- `finish_reason: "tool_calls"`
- Tool name and arguments correctly extracted

### ⚠️ Warning Signs
- `⚠️ Model did not call a tool` message
- Model responds with text instead of tool call
- `finish_reason: "stop"` instead of `"tool_calls"`
- Empty `tool_calls` array

### ❌ Error Indicators
- `❌ FAILED` message
- HTTP error codes (400, 401, 403, 429, 500)
- Network errors
- Malformed responses

---

## Performance Metrics

Typical latencies (vary by model and load):

| Model | Average Latency | Notes |
|-------|----------------|-------|
| GPT-4o mini | 800-1500ms | Fast, reliable |
| Qwen2 72B | 1000-2000ms | Free, good performance |
| Claude 3.7 Sonnet | 900-1800ms | High quality |
| Gemini 2.1 Pro | 1200-2500ms | Multimodal capable |
| DeepSeek V3.5 | 1500-3000ms | Advanced reasoning |

**Note:** First request may be slower due to cold start.

---

## Next Steps After Testing

1. ✅ Verify basic tool calling works
2. ✅ Test with multiple models
3. ⬜ Integrate into chat UI
4. ⬜ Implement real tool functions
5. ⬜ Add error handling
6. ⬜ Build tool management interface
7. ⬜ Deploy to production
