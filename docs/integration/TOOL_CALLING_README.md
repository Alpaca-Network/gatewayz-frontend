# Tool Calling Test Suite for Gatewayz

This directory contains comprehensive testing tools for validating tool/function calling capabilities across AI models on the Gatewayz platform.

## 📋 What is Tool Calling?

Tool calling (also known as function calling) allows AI models to:
- Call external functions/APIs during conversations
- Retrieve real-time data (weather, stock prices, etc.)
- Perform calculations
- Search databases
- Execute actions (send emails, create events, etc.)

## 🎯 Quick Start

### 1. Get Your API Key

Visit [https://beta.gatewayz.ai/settings/keys](https://beta.gatewayz.ai/settings/keys) to get your API key.

### 2. Set Environment Variable

```bash
export GATEWAYZ_API_KEY="your_api_key_here"
```

### 3. Run a Test

**Simplest test (using curl):**
```bash
bash test-tool-calling-curl.sh
```

**Quick TypeScript test:**
```bash
pnpm tsx test-tool-calling-simple.ts
```

**Full test suite:**
```bash
pnpm tsx test-tool-calling.ts --list  # List all models
pnpm tsx test-tool-calling.ts "Qwen: Qwen2 72B A16B 2507"  # Test specific model
pnpm tsx test-tool-calling.ts --all  # Test all models (uses credits!)
```

## 📁 Files in This Suite

| File | Purpose |
|------|---------|
| `test-tool-calling.ts` | Main test suite with full features |
| `test-tool-calling-simple.ts` | Minimal example for quick testing |
| `test-tool-calling-curl.sh` | Shell script using curl |
| `TOOL_CALLING_TESTS.md` | Complete documentation |
| `TOOL_CALLING_README.md` | This file (quick start guide) |

## 🤖 Supported Models

Run `pnpm tsx test-tool-calling.ts --list` to see all models supporting tool calling.

**FREE models for testing:**
- Qwen: Qwen2 72B A16B 2507 ⭐ (Recommended for testing)

**Premium models:**
- GPT-4o mini (OpenAI)
- Anthropic: Claude 3.7 Sonnet
- Google: Gemini 2.1 Pro
- DeepSeek: DeepSeek V3.5
- And more...

## 📖 Examples

### Example 1: Basic Weather Query

```bash
pnpm tsx test-tool-calling-simple.ts
```

Expected output:
```
🧪 Testing Tool Calling with Qwen2 72B (FREE model)

Prompt: "What's the weather like in Tokyo?"

✅ SUCCESS! Model called a tool:

Tool: get_weather
Arguments: {"location":"Tokyo"}

🎉 Tool calling is working!
```

### Example 2: Test Multiple Scenarios

```bash
pnpm tsx test-tool-calling.ts "Qwen: Qwen2 72B A16B 2507"
```

This will test:
1. Weather queries
2. Mathematical calculations
3. Web searches
4. Multi-step tasks

### Example 3: Using curl

```bash
export GATEWAYZ_API_KEY="your_key"
bash test-tool-calling-curl.sh
```

## 🔧 Tool Definitions

The test suite includes three example tools:

### 1. Weather Tool
```json
{
  "name": "get_weather",
  "description": "Get current weather in a location",
  "parameters": {
    "location": "string (required)",
    "unit": "celsius | fahrenheit (optional)"
  }
}
```

### 2. Calculator Tool
```json
{
  "name": "calculate",
  "description": "Perform mathematical calculations",
  "parameters": {
    "expression": "string (required)"
  }
}
```

### 3. Web Search Tool
```json
{
  "name": "search_web",
  "description": "Search the web",
  "parameters": {
    "query": "string (required)",
    "num_results": "number (optional)"
  }
}
```

## 📊 Test Results Interpretation

### ✅ Successful Test
```
✅ Tool call successful!
Tool called: get_weather
Arguments: { "location": "San Francisco, CA" }
Latency: 1234ms
```

### ❌ Failed Test
```
❌ FAILED
Error: Model did not call any tools
```

Common reasons for failure:
1. Model doesn't actually support tools (despite being filtered)
2. Prompt not explicit enough
3. Tool definitions have incorrect format
4. API key issues

## 🚀 Advanced Usage

### Test All Models
```bash
# Warning: This will use credits for paid models!
pnpm tsx test-tool-calling.ts --all
```

### Custom API URL
```bash
export NEXT_PUBLIC_API_BASE_URL="https://custom-api.example.com"
pnpm tsx test-tool-calling.ts "GPT-4o mini"
```

### Programmatic Usage
```typescript
import { testToolCalling, EXAMPLE_TOOLS } from './test-tool-calling';

const result = await testToolCalling(
  apiKey,
  'GPT-4o mini',
  'What is the weather in London?',
  EXAMPLE_TOOLS
);

if (result.success) {
  console.log(`Tool: ${result.toolCalled}`);
  console.log(`Args: ${JSON.stringify(result.toolArguments)}`);
}
```

## 🔍 Testing Strategy

### Phase 1: Basic Validation ✅
- [x] Tool definitions format correctly
- [x] API accepts tool parameter
- [x] Models parse tool definitions
- [x] Models call appropriate tools
- [x] Tool arguments extracted correctly

### Phase 2: Integration Testing
- [ ] Test tool execution workflow
- [ ] Test with tool results in conversation
- [ ] Test multiple sequential tool calls
- [ ] Test parallel tool calls
- [ ] Test error handling

### Phase 3: UI Integration
- [ ] Build tool management UI
- [ ] Add tool execution logic
- [ ] Display tool calls in chat interface
- [ ] Add tool configuration settings

## 🐛 Troubleshooting

### "No authorization header provided"
```bash
# Make sure you've set the environment variable
export GATEWAYZ_API_KEY="your_key"
```

### "Model did not call any tools"
- Try a more explicit prompt: "Use the get_weather tool to check the weather in Paris"
- Some models may not support tools despite being in the filtered list
- Check the model's documentation for specific requirements

### "Trial credits have been used up"
- Use FREE models like "Qwen: Qwen2 72B A16B 2507"
- Add credits at [https://beta.gatewayz.ai/settings/credits](https://beta.gatewayz.ai/settings/credits)

### Rate Limiting (429 errors)
- The script includes automatic retry with exponential backoff
- Add delays between tests when testing multiple models
- Use `--all` sparingly

## 📚 Documentation

For complete documentation, see [TOOL_CALLING_TESTS.md](TOOL_CALLING_TESTS.md)

Topics covered:
- Detailed API reference
- Request/response formats
- Tool definition schemas
- Integration guides
- Best practices
- Architecture considerations

## 🔗 Useful Links

- **Model Browser (with tool filter)**: https://beta.gatewayz.ai/models?parameters=tools
- **API Keys**: https://beta.gatewayz.ai/settings/keys
- **Credits**: https://beta.gatewayz.ai/settings/credits
- **API Documentation**: https://api.gatewayz.ai/docs
- **OpenAI Tool Calling Spec**: https://platform.openai.com/docs/guides/function-calling

## 💡 Next Steps

1. **Run the basic test**:
   ```bash
   pnpm tsx test-tool-calling-simple.ts
   ```

2. **Experiment with prompts**: Modify the test prompts to see how different models respond

3. **Add custom tools**: Extend `EXAMPLE_TOOLS` with your own tool definitions

4. **Integrate into your app**: Use the examples to add tool calling to your Gatewayz chat UI

5. **Build real integrations**: Connect to actual APIs (weather, calculator, search, etc.)

## 🤝 Contributing

To add new test cases:

1. Add tools to `EXAMPLE_TOOLS` in `test-tool-calling.ts`
2. Add test prompts to `TEST_PROMPTS`
3. Implement tool execution in `executeTool()` function
4. Update documentation

## 📝 License

Part of the Gatewayz platform. See main LICENSE file for details.

---

**Questions or Issues?**

- Check [TOOL_CALLING_TESTS.md](TOOL_CALLING_TESTS.md) for detailed docs
- Visit https://beta.gatewayz.ai for the web interface
- Review API docs at https://api.gatewayz.ai/docs
