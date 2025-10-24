# Braintrust Integration Guide

## Overview

Braintrust has been integrated into the Gatewayz Backend to provide comprehensive LLM observability, tracing, and evaluation capabilities. This allows you to monitor, debug, and optimize your LLM interactions in real-time.

## What's Been Configured

### 1. Dependencies
- **Package**: `braintrust` (v0.3.5) has been added to `requirements.txt`
- **Status**: Installed and ready to use

### 2. Environment Configuration
- **API Key**: `BRAINTRUST_API_KEY` configured in `.env`
- **Example**: Added to `.env.example` for team reference
- **Security**: The `.env` file should be kept secure and not committed to version control

### 3. Application Initialization
Braintrust is initialized during application startup in `src/main.py:250`:

```python
from braintrust import init_logger
braintrust_logger = init_logger(project="Gatewayz Backend")
```

### 4. Endpoint Tracing
The following endpoints have been instrumented with Braintrust tracing:

#### `/v1/chat/completions` (Line 228)
- Captures all chat completion requests
- Logs input messages, output content, and full token metrics
- Tracks provider, model, user_id, session_id, and trial status

#### `/v1/responses` (Line 751)
- Unified response API with Braintrust tracing
- Supports multimodal input/output tracking
- Same comprehensive logging as chat completions

### 5. Metrics Tracked

For each LLM request, Braintrust captures:

**Input Data:**
- Complete message history
- Model and provider information
- User context (user_id, session_id)

**Output Data:**
- Generated response content
- Completion status

**Metrics:**
- `prompt_tokens`: Number of input tokens
- `completion_tokens`: Number of output tokens
- `total_tokens`: Combined token usage
- `latency_ms`: Request duration in milliseconds
- `cost_usd`: Calculated cost (for paid users)

**Metadata:**
- `model`: Model identifier
- `provider`: Gateway provider used (openrouter, portkey, etc.)
- `user_id`: Internal user identifier
- `session_id`: Chat session identifier (if applicable)
- `is_trial`: Whether this is a trial request
- `environment`: Environment tag (live, staging, development)
- `endpoint`: API endpoint called

## How to Use

### Viewing Traces

1. **Access Braintrust Dashboard**
   - Visit: https://www.braintrust.dev/
   - Log in with your account
   - Navigate to "Gatewayz Backend" project

2. **Explore Traces**
   - View real-time LLM calls as they happen
   - Filter by model, provider, user, or time range
   - Analyze latency, cost, and token usage patterns

3. **Debug Issues**
   - Click on any trace to see full request/response details
   - View input messages and output content
   - Analyze error traces and exceptions

### Code Examples

#### Basic Usage (Already Integrated)
The chat endpoints automatically trace all requests. No additional code needed!

#### Custom Tracing (For New Endpoints)
```python
from braintrust import start_span, traced

@traced(name="custom_endpoint", type="llm")
async def my_llm_endpoint(messages, model):
    span = start_span(name=f"llm_{model}", type="llm")

    try:
        # Your LLM call here
        result = await call_llm(messages, model)

        # Log to Braintrust
        span.log(
            input=messages,
            output=result["content"],
            metrics={
                "prompt_tokens": result["usage"]["prompt_tokens"],
                "completion_tokens": result["usage"]["completion_tokens"],
                "total_tokens": result["usage"]["total_tokens"],
                "latency_ms": result["latency"],
            },
            metadata={
                "model": model,
                "provider": "custom",
            }
        )
        span.end()

        return result
    except Exception as e:
        span.end()
        raise
```

#### Streaming Support
For streaming responses, you can log incremental updates:

```python
@traced(name="streaming_endpoint", type="llm")
async def streaming_endpoint(messages, model):
    span = start_span(name=f"stream_{model}", type="llm")
    accumulated_content = ""

    try:
        async for chunk in stream_llm(messages, model):
            accumulated_content += chunk
            # Optionally log intermediate chunks
            yield chunk

        # Log final result
        span.log(
            input=messages,
            output=accumulated_content,
            metrics={"tokens": len(accumulated_content) // 4},
        )
        span.end()
    except Exception as e:
        span.end()
        raise
```

## Monitoring Best Practices

### 1. Regular Review
- Check Braintrust dashboard daily for anomalies
- Monitor average latency and cost trends
- Identify high-cost users or models

### 2. Error Analysis
- Review failed traces to identify issues
- Track error rates by provider
- Analyze timeout patterns

### 3. Performance Optimization
- Compare latency across providers
- Identify slow models or endpoints
- Optimize token usage based on insights

### 4. Cost Management
- Track cost per user and model
- Identify expensive queries
- Set up alerts for cost spikes

## Troubleshooting

### Traces Not Appearing

1. **Check API Key**
   ```bash
   python3 -c "import os; from dotenv import load_dotenv; load_dotenv(); print('API Key configured:', 'Yes' if os.getenv('BRAINTRUST_API_KEY') else 'No')"
   ```

2. **Verify Braintrust Import**
   ```bash
   python3 -c "import braintrust; print('Braintrust imported successfully')"
   ```

3. **Check Logs**
   - Look for "✅ Braintrust tracing initialized" in startup logs
   - Check for "Failed to log to Braintrust" warnings in application logs

### High Volume Issues

If you experience performance issues with high request volumes:

1. **Async Logging**: Braintrust logging is non-blocking and shouldn't impact performance
2. **Sampling**: Consider implementing sampling for high-volume endpoints:
   ```python
   import random
   if random.random() < 0.1:  # Sample 10% of requests
       span.log(...)
   ```

### Privacy Concerns

To avoid logging sensitive data:

1. **Mask User IDs**: Use hashed or anonymized identifiers
2. **Filter Content**: Remove PII from logged messages
3. **Configure Metadata**: Only log non-sensitive metadata fields

## Integration Files

### Modified Files
- `src/routes/chat.py`: Added tracing to chat endpoints
- `src/main.py`: Added Braintrust initialization
- `requirements.txt`: Added braintrust dependency
- `.env.example`: Added BRAINTRUST_API_KEY template

### New Files
- `src/utils/braintrust_tracing.py`: Example tracing utilities
- `docs/BRAINTRUST_INTEGRATION.md`: This documentation
- `.env`: Environment configuration (not committed)

## Support

- **Braintrust Docs**: https://www.braintrust.dev/docs
- **API Reference**: https://www.braintrust.dev/docs/reference/python
- **Support**: support@braintrust.dev

## Next Steps

1. ✅ Verify traces appear in Braintrust dashboard
2. ✅ Set up alerts for critical metrics
3. ✅ Create evaluation datasets for model testing
4. ✅ Configure team access and permissions
5. ✅ Set up regular review cadence
