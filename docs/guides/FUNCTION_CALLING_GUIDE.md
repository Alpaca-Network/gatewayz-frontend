# Function Calling Guide

This guide explains how to use function calling (tools) with the Gatewayz backend API.

## Overview

Function calling allows you to describe functions to the model and have it intelligently choose to output a JSON object containing arguments to call those functions. This is useful for building AI applications that can interact with external tools and APIs.

## Supported Endpoints

Function calling is supported on the following endpoints:

- `POST /v1/chat/completions` - Standard OpenAI-compatible chat completions
- `POST /v1/responses` - Unified responses endpoint

## Basic Usage

### Request Format

Include a `tools` parameter in your request with an array of function definitions:

```json
{
  "model": "gpt-4",
  "messages": [
    {
      "role": "user",
      "content": "What's the weather like in San Francisco?"
    }
  ],
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "get_weather",
        "description": "Get the current weather in a given location",
        "parameters": {
          "type": "object",
          "properties": {
            "location": {
              "type": "string",
              "description": "The city and state, e.g. San Francisco, CA"
            },
            "unit": {
              "type": "string",
              "enum": ["celsius", "fahrenheit"],
              "description": "The unit of temperature"
            }
          },
          "required": ["location"]
        }
      }
    }
  ]
}
```

### Response Format

When the model decides to call a function, the response will include `tool_calls` in the message:

```json
{
  "id": "chatcmpl-123",
  "object": "chat.completion",
  "created": 1677652288,
  "model": "gpt-4",
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
              "arguments": "{\"location\": \"San Francisco, CA\", \"unit\": \"fahrenheit\"}"
            }
          }
        ]
      },
      "finish_reason": "tool_calls"
    }
  ],
  "usage": {
    "prompt_tokens": 82,
    "completion_tokens": 18,
    "total_tokens": 100
  }
}
```

## Provider Support

### Fully Supported Providers

The following providers fully support function calling:

- **OpenRouter** - Full support for OpenAI-compatible function calling
- **HuggingFace** - Supports tools parameter (added in recent update)
- **Featherless** - Full support
- **Fireworks** - Full support
- **Together** - Full support
- **Portkey** - Supports tools (depends on underlying provider)
- **AIMO** - Full support
- **xAI** - Full support
- **Near** - Full support

### Partial Support

- **Google Vertex** - Tools are extracted but transformation from OpenAI format to Gemini format is not yet implemented. Function calling may not work correctly.

### Provider-Specific Notes

#### HuggingFace

HuggingFace Router supports the `tools` parameter. Ensure your model supports function calling.

#### Google Vertex

Google Vertex AI uses a different function calling format (Gemini FunctionDeclaration). Currently, tools are extracted from the request but not transformed. Full support requires implementing the transformation layer.

## Examples

### Python Example

```python
import httpx

API_URL = "https://your-api.com"
API_KEY = "your-api-key"

tools = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Get the current weather",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {"type": "string"}
                },
                "required": ["location"]
            }
        }
    }
]

response = httpx.post(
    f"{API_URL}/v1/chat/completions",
    headers={"Authorization": f"Bearer {API_KEY}"},
    json={
        "model": "gpt-4",
        "messages": [
            {"role": "user", "content": "What's the weather in NYC?"}
        ],
        "tools": tools
    }
)

data = response.json()
if data["choices"][0]["message"].get("tool_calls"):
    # Handle function call
    tool_call = data["choices"][0]["message"]["tool_calls"][0]
    function_name = tool_call["function"]["name"]
    arguments = json.loads(tool_call["function"]["arguments"])
    # Call your function with arguments
```

### JavaScript Example

```javascript
const response = await fetch('https://your-api.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'gpt-4',
    messages: [
      { role: 'user', content: "What's the weather in NYC?" }
    ],
    tools: [
      {
        type: 'function',
        function: {
          name: 'get_weather',
          description: 'Get the current weather',
          parameters: {
            type: 'object',
            properties: {
              location: { type: 'string' }
            },
            required: ['location']
          }
        }
      }
    ]
  })
});

const data = await response.json();
if (data.choices[0].message.tool_calls) {
  // Handle function call
  const toolCall = data.choices[0].message.tool_calls[0];
  const functionName = toolCall.function.name;
  const arguments = JSON.parse(toolCall.function.arguments);
  // Call your function with arguments
}
```

## Best Practices

1. **Clear Descriptions**: Provide clear, detailed descriptions for your functions. This helps the model understand when and how to use them.

2. **Required Parameters**: Use the `required` array to specify which parameters are mandatory.

3. **Type Definitions**: Always specify types for parameters. Use `enum` for parameters with limited options.

4. **Error Handling**: Always check for `tool_calls` in the response before processing. The model may choose not to call a function.

5. **Multiple Tools**: You can provide multiple tools in a single request. The model will choose which ones to call.

## Troubleshooting

### Tools Not Being Called

1. **Check Provider Support**: Ensure your provider supports function calling (see Provider Support section above).

2. **Check Model**: Not all models support function calling. Use models known to support it (e.g., GPT-4, GPT-3.5-turbo).

3. **Check Function Description**: Ensure your function description clearly explains when the function should be used.

4. **Check Logs**: Enable debug logging to see if tools are being passed to the provider.

### Tools Parameter Ignored

If tools are being ignored:

1. **Check Provider**: Some providers may not support tools. Check the Provider Support section.

2. **Check Request Format**: Ensure tools is an array of objects with the correct structure.

3. **Check Logs**: Diagnostic logging will show if tools are detected. Look for log messages containing "Tools parameter detected".

## Testing

Use the diagnostic script to test tools support:

```bash
python scripts/diagnose_tools_support.py
```

Run E2E tests:

```bash
export GATEWAYZ_API_URL=https://your-api.com
export GATEWAYZ_API_KEY=your-api-key
python scripts/integration-tests/test_function_calling_e2e.py
```

## Health Checks

Monitor function calling health:

```bash
export GATEWAYZ_API_URL=https://your-api.com
export GATEWAYZ_API_KEY=your-api-key
python scripts/healthcheck_function_calling.py
```

## Limitations

1. **Google Vertex**: Full function calling support requires transformation from OpenAI format to Gemini format, which is not yet implemented.

2. **Model Support**: Not all models support function calling. Check model documentation.

3. **Streaming**: Function calling works with streaming, but tool calls may appear in multiple chunks.

## Additional Resources

- [OpenAI Function Calling Documentation](https://platform.openai.com/docs/guides/function-calling)
- [OpenRouter Function Calling](https://openrouter.ai/docs/function-calling)
- [Google Vertex Function Calling](https://cloud.google.com/vertex-ai/docs/generative-ai/model-reference/gemini#function_calling)

