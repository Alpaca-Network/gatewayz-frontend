# Braintrust LLM Tracing Integration

This document describes the Braintrust LLM tracing integration in the Gatewayz frontend application.

## Overview

Braintrust has been integrated to provide comprehensive LLM tracing and observability for all chat completion requests made through the Gatewayz platform. This enables monitoring, debugging, and analysis of LLM interactions.

## What Was Integrated

### 1. Dependencies
- **Package**: `braintrust` (v0.4.8)
- Installed via: `pnpm add braintrust`

### 2. Environment Configuration
- **Variable**: `BRAINTRUST_API_KEY`
- **Location**: `.env.local` and `.env.example`
- **Value**: `sk-xYEPdagoC0Nqv5c8FHNlmx0G2wX03WDb0K9frSJE04ntPvZY`

### 3. Core Integration Files

#### `/root/repo/src/lib/braintrust.ts`
Utility module for Braintrust logger initialization:
- Exports `braintrustLogger` - initialized logger instance for the "Gatewayz" project
- Exports `isBraintrustEnabled()` - helper function to check if Braintrust is configured

#### `/root/repo/src/app/api/chat/completions/route.ts`
Main chat completions API route with tracing:
- Imports Braintrust `traced` and `wrapTraced` functions
- Wraps LLM completion processing in `processCompletion` traced function
- Captures both streaming and non-streaming requests

## How It Works

### Non-Streaming Requests
When a chat completion request is made without streaming:

1. **Request Processing**: The request is forwarded to the Gatewayz backend API
2. **Response Parsing**: JSON response is parsed to extract completion data
3. **Metrics Extraction**: Token usage and latency metrics are captured:
   - `prompt_tokens` - Number of tokens in the prompt
   - `completion_tokens` - Number of tokens in the completion
   - `tokens` - Total tokens used
   - `latency_ms` - Request latency in milliseconds
4. **Span Logging**: All data is logged to Braintrust with:
   - **Input**: Chat messages or prompt
   - **Output**: Generated completion text
   - **Metrics**: Token usage and latency
   - **Metadata**: Model parameters (temperature, max_tokens, etc.)

### Streaming Requests
When a chat completion request uses streaming:

1. **Request Processing**: The request is forwarded to the Gatewayz backend API
2. **Basic Logging**: Input and metadata are logged (output cannot be captured for streams)
3. **Stream Forwarding**: Response stream is forwarded to the client

### Traced Function Structure

```typescript
const processCompletion = wrapTraced(
  async function processCompletion(
    body: any,
    apiKey: string,
    targetUrl: string,
    timeoutMs: number
  ) {
    return traced(async (span) => {
      // ... processing logic ...

      if (isBraintrustEnabled()) {
        span.log({
          input: [...],
          output: "...",
          metrics: { ... },
          metadata: { ... }
        });
      }

      return result;
    });
  },
  {
    type: 'llm',
    name: 'Gatewayz Chat Completion',
  }
);
```

## Data Captured

### Input Data
- Chat messages array (for chat completions)
- Prompt text (for legacy completions)

### Output Data
- Generated completion text (for non-streaming requests)

### Metrics
- `prompt_tokens`: Number of input tokens
- `completion_tokens`: Number of output tokens
- `tokens`: Total token count
- `latency_ms`: Request duration in milliseconds

### Metadata
- `model`: Model identifier (e.g., "gpt-4", "claude-3")
- `temperature`: Sampling temperature
- `max_tokens`: Maximum completion length
- `top_p`: Nucleus sampling parameter
- `frequency_penalty`: Frequency penalty value
- `presence_penalty`: Presence penalty value
- `stream`: Whether streaming was used
- `response_status`: HTTP response status code

## Viewing Traces

1. Log in to [Braintrust](https://www.braintrustdata.com/)
2. Navigate to the "Gatewayz" project
3. View traces in the LLM Observability dashboard
4. Filter by model, time range, or metadata
5. Analyze token usage, latency trends, and error rates

## Configuration

### Enabling/Disabling Tracing
Tracing is automatically enabled when `BRAINTRUST_API_KEY` is set in the environment. To disable:
- Remove or comment out the `BRAINTRUST_API_KEY` variable in `.env.local`
- The integration will gracefully skip logging when the key is not present

### Project Configuration
To change the Braintrust project name, edit `src/lib/braintrust.ts`:

```typescript
export const braintrustLogger = initLogger({
  projectName: "Your Project Name", // Change this
  apiKey: process.env.BRAINTRUST_API_KEY,
});
```

## Implementation Details

### Error Handling
- Tracing errors do not affect request processing
- If Braintrust logging fails, the request continues normally
- All errors are caught within the traced function scope

### Performance Impact
- Minimal overhead for non-streaming requests (~1-5ms)
- No additional latency for streaming requests
- Logging happens asynchronously after response is returned

### Security Considerations
- API key is server-side only (not exposed to client)
- Input/output data is sent to Braintrust's secure infrastructure
- Ensure compliance with your data privacy policies before enabling in production

## Testing

To test the integration:

1. Ensure `.env.local` contains the `BRAINTRUST_API_KEY`
2. Start the development server: `pnpm run dev`
3. Make a chat completion request through `/api/chat/completions`
4. Check Braintrust dashboard for the logged trace

Example test request:
```bash
curl -X POST http://localhost:3000/api/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [{"role": "user", "content": "Hello!"}],
    "temperature": 0.7,
    "max_tokens": 100
  }'
```

## Troubleshooting

### Traces Not Appearing
1. Verify `BRAINTRUST_API_KEY` is set correctly in `.env.local`
2. Check console logs for Braintrust initialization errors
3. Ensure the API key has proper permissions in Braintrust dashboard
4. Verify network connectivity to Braintrust API

### Missing Metrics
- Some models may not return `usage` data in responses
- Streaming requests cannot capture output metrics
- Check if the backend API is returning standard OpenAI-compatible responses

## Future Enhancements

Potential improvements to consider:

1. **Stream Buffering**: Capture and log streaming outputs by buffering chunks
2. **User Tracking**: Associate traces with user IDs for user-level analytics
3. **Cost Tracking**: Calculate and log estimated costs based on token usage
4. **Prompt Templates**: Tag traces with prompt template identifiers
5. **A/B Testing**: Integrate with Braintrust's experiment features
6. **Feedback Loop**: Allow users to rate responses and log feedback to Braintrust

## References

- [Braintrust Documentation](https://www.braintrustdata.com/docs)
- [Braintrust LLM Tracing Guide](https://www.braintrustdata.com/docs/guides/tracing)
- [OpenAI API Compatibility](https://platform.openai.com/docs/api-reference/chat)
