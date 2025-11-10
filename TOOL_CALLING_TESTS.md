# Tool Calling Test Suite Documentation

This document describes how to test tool/function calling capabilities across models on the Gatewayz platform.

## Overview

Tool calling (also known as function calling) allows AI models to invoke external functions or APIs to perform tasks like:
- Retrieving real-time data (weather, stock prices, etc.)
- Performing calculations
- Searching databases or the web
- Executing actions (sending emails, creating calendar events, etc.)

## Models Supporting Tool Calling

Based on the filter at https://beta.gatewayz.ai/models?parameters=tools, the following models support tool calling:

1. **GPT-4o mini** (OpenAI)
   - Supports: `tools`, `temperature`, `top_p`
   - Cost: $0.15/1M input, $0.60/1M output

2. **Qwen: Qwen2 72B A16B 2507** (Qwen)
   - Supports: `tools`, `temperature`
   - Cost: FREE

3. **Qwen: Qwen2 57B A14B 2507** (Qwen)
   - Supports: `tools`, `temperature`, `top_p`
   - Cost: $0.15/1M input, $0.85/1M output

4. **DeepSeek: DeepSeek V3.5** (DeepSeek)
   - Supports structured tool calling
   - Designed for code agents and search agents

5. **DeepSeek: DeepSeek V3 Reasoner** (DeepSeek)
   - Supports structured tool calling
   - Advanced reasoning capabilities

6. **Google: Gemini 2.1 Pro** (Google)
   - Supports: `tools`, `temperature`, `top_p`
   - Multimodal capabilities

7. **Anthropic: Claude 3.7 Sonnet** (Anthropic)
   - Supports: `tools`, `temperature`, `top_p`
   - High performance

8. **Meta: Llama 3.3 70B** (Meta)
   - Supports: `tools`, `temperature`
   - Open source

## Test Script

### Installation

The test script is located at `/root/repo/test-tool-calling.ts` and requires:

1. Node.js 18+ or compatible runtime
2. `tsx` for TypeScript execution
3. A valid Gatewayz API key

### Setup

```bash
# Install dependencies (if not already installed)
pnpm install

# Set your API key as an environment variable (recommended)
export GATEWAYZ_API_KEY="your_api_key_here"

# Or the script will prompt you for it interactively
```

### Usage

#### List Available Models

```bash
pnpm tsx test-tool-calling.ts --list
```

#### Test a Specific Model

```bash
pnpm tsx test-tool-calling.ts "GPT-4o mini"
```

```bash
pnpm tsx test-tool-calling.ts "Qwen: Qwen2 72B A16B 2507"
```

#### Test All Models

```bash
pnpm tsx test-tool-calling.ts --all
```

#### Show Help

```bash
pnpm tsx test-tool-calling.ts --help
```

## Test Cases

The script includes several test scenarios:

### 1. Weather Query
**Prompt:** "What's the weather like in San Francisco?"
- **Expected Tool:** `get_current_weather`
- **Expected Arguments:** `{ location: "San Francisco, CA" }`

### 2. Mathematical Calculation
**Prompt:** "What is 47 * 89 + 234?"
- **Expected Tool:** `calculate`
- **Expected Arguments:** `{ expression: "47 * 89 + 234" }`

### 3. Web Search
**Prompt:** "Search for the latest news about artificial intelligence"
- **Expected Tool:** `search_web`
- **Expected Arguments:** `{ query: "latest news artificial intelligence" }`

### 4. Multi-step Task
**Prompt:** "What is the square root of 144, and what is the weather in New York?"
- **Expected:** Multiple tool calls or sequential reasoning

## Tool Definitions

The test suite includes three example tools:

### 1. get_current_weather
Gets the current weather in a specified location.

**Parameters:**
- `location` (string, required): City and state, e.g., "San Francisco, CA"
- `unit` (string, optional): Temperature unit - "celsius" or "fahrenheit"

### 2. calculate
Performs mathematical calculations.

**Parameters:**
- `expression` (string, required): Mathematical expression to evaluate

### 3. search_web
Searches the web for information.

**Parameters:**
- `query` (string, required): Search query
- `num_results` (number, optional): Number of results to return (default: 5)

## Expected Output

### Successful Test

```
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
Latency: 1234ms

Tool result: {"location":"San Francisco, CA","temperature":72,"unit":"fahrenheit","conditions":"Sunny","humidity":65}

Sending follow-up with tool result...

Final response:
The weather in San Francisco is currently sunny with a temperature of 72°F and 65% humidity. It's a beautiful day!
```

### Failed Test

```
================================================================================
Testing: Some Model
Prompt: What's the weather like in San Francisco?
================================================================================

❌ FAILED
Error: Model did not call any tools
Latency: 567ms
```

## Integration with Gatewayz Chat UI

To enable tool calling in the main chat interface (`/root/repo/src/app/chat/page.tsx`), you would need to:

1. **Add Tool Configuration UI:**
   - Add a section to define available tools
   - Allow users to enable/disable specific tools
   - Provide a way to configure tool parameters

2. **Modify Chat Request:**
   - Include `tools` array in the request body
   - Add `tool_choice` parameter (auto, required, or specific function)

3. **Handle Tool Call Responses:**
   - Detect when the model returns tool calls instead of text
   - Execute the tool functions (client-side or server-side)
   - Send tool results back to the model
   - Display tool calls and results in the UI

4. **Update Message Type:**
   - Extend the `Message` type to include `tool_calls`
   - Add support for `tool` role messages

### Example Integration Code

```typescript
// In the chat request function
const requestBody = {
  model: selectedModel,
  messages: conversationHistory,
  tools: enabledTools, // Add this
  tool_choice: 'auto', // Add this
  temperature: temperature,
  max_tokens: maxTokens,
  stream: true,
};

// In the response handler
if (responseData.choices[0].message.tool_calls) {
  const toolCalls = responseData.choices[0].message.tool_calls;

  // Execute tools and collect results
  const toolResults = await executeTools(toolCalls);

  // Send back to model with tool results
  const followUpRequest = {
    model: selectedModel,
    messages: [
      ...conversationHistory,
      responseData.choices[0].message, // Assistant message with tool calls
      ...toolResults.map(result => ({
        role: 'tool',
        tool_call_id: result.id,
        name: result.name,
        content: result.output,
      })),
    ],
    temperature: temperature,
    max_tokens: maxTokens,
    stream: true,
  };
}
```

## Testing Strategy

### Basic Tests
1. ✅ Tool definitions are correctly formatted
2. ✅ API accepts requests with tools
3. ✅ Models can parse tool definitions
4. ✅ Models call appropriate tools for given prompts
5. ✅ Tool arguments are correctly extracted

### Advanced Tests
6. ⬜ Models handle tool execution results
7. ⬜ Models can use tool results in their responses
8. ⬜ Multiple sequential tool calls work
9. ⬜ Parallel tool calls work (if supported)
10. ⬜ Error handling for invalid tool calls
11. ⬜ Models respect `tool_choice` parameter
12. ⬜ Streaming works with tool calls

## Troubleshooting

### Common Issues

1. **"No authorization header provided"**
   - Ensure you've set `GATEWAYZ_API_KEY` or entered it when prompted

2. **"Model did not call any tools"**
   - The model may not support tools despite being in the filtered list
   - Try a more explicit prompt that clearly requires tool usage
   - Check if the model requires specific formatting

3. **"Bad request: ..."**
   - Tool definitions may not be in the correct format
   - Check the OpenAI function calling specification

4. **"Trial credits have been used up"**
   - Use FREE models (like Qwen2 72B) for testing
   - Add credits to your account

5. **Rate limiting (429)**
   - The script includes automatic retry with backoff
   - Add delays between requests when testing multiple models

## API Reference

### Request Format

```typescript
POST /v1/chat/completions
Content-Type: application/json
Authorization: Bearer {api_key}

{
  "model": "GPT-4o mini",
  "messages": [
    {
      "role": "user",
      "content": "What's the weather in SF?"
    }
  ],
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "get_weather",
        "description": "Get current weather",
        "parameters": {
          "type": "object",
          "properties": {
            "location": {
              "type": "string",
              "description": "City name"
            }
          },
          "required": ["location"]
        }
      }
    }
  ],
  "tool_choice": "auto",
  "temperature": 0.7
}
```

### Response Format (Tool Call)

```json
{
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": null,
        "tool_calls": [
          {
            "id": "call_abc123",
            "type": "function",
            "function": {
              "name": "get_weather",
              "arguments": "{\"location\":\"San Francisco\"}"
            }
          }
        ]
      },
      "finish_reason": "tool_calls"
    }
  ]
}
```

### Follow-up Request with Tool Results

```json
{
  "model": "GPT-4o mini",
  "messages": [
    {
      "role": "user",
      "content": "What's the weather in SF?"
    },
    {
      "role": "assistant",
      "content": null,
      "tool_calls": [
        {
          "id": "call_abc123",
          "type": "function",
          "function": {
            "name": "get_weather",
            "arguments": "{\"location\":\"San Francisco\"}"
          }
        }
      ]
    },
    {
      "role": "tool",
      "tool_call_id": "call_abc123",
      "name": "get_weather",
      "content": "{\"temperature\":72,\"conditions\":\"sunny\"}"
    }
  ],
  "temperature": 0.7
}
```

## Next Steps

1. **Extend Test Coverage:**
   - Add more complex multi-tool scenarios
   - Test error handling
   - Test with different parameter combinations

2. **UI Integration:**
   - Build tool management UI
   - Add tool execution logic
   - Display tool calls in chat

3. **Production Tools:**
   - Implement real tool integrations (weather APIs, calculators, etc.)
   - Add authentication for tool calls
   - Implement rate limiting and caching

4. **Monitoring:**
   - Track tool calling success rates
   - Monitor latency for tool-enabled requests
   - Log tool usage analytics

## Resources

- [OpenAI Function Calling Guide](https://platform.openai.com/docs/guides/function-calling)
- [Anthropic Tool Use Documentation](https://docs.anthropic.com/claude/docs/tool-use)
- [Gatewayz API Documentation](https://api.gatewayz.ai/docs)
- [Model Filter: Tool Support](https://beta.gatewayz.ai/models?parameters=tools)

## Contributing

To add new test cases or tools:

1. Add tool definitions to `EXAMPLE_TOOLS` array
2. Add test prompts to `TEST_PROMPTS` array
3. Implement tool execution in `executeTool()` function
4. Update this documentation with the new tests

## License

This test suite is part of the Gatewayz platform and follows the same license terms.
