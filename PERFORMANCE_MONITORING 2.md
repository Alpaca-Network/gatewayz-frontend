# Chat Performance Monitoring

A comprehensive performance measurement system for tracking chat response times and identifying bottlenecks.

## Overview

The performance monitoring system tracks key metrics for every chat message:

- **TTFT (Time to First Token)**: How long before the model starts responding
- **Total Response Time**: Complete time from user click to response completion
- **Network Latency**: Network round-trip time
- **Backend Processing**: Time spent on backend processing
- **Tokens Per Second**: Streaming throughput
- **Error Tracking**: Failed requests and retry counts

## How to Use

### 1. Enable Development Mode

The performance monitor is **only available in development mode**:

```bash
npm run dev
```

### 2. Access the Performance Monitor

1. Open the chat page at `http://localhost:3000/chat`
2. Look for the **Activity icon button** in the bottom-right corner
3. Click it to open the performance monitor panel

### 3. Understanding the Metrics

#### Overview Tab
- **Avg TTFT**: Average time until first token appears (lower is better)
- **Avg Total**: Average complete response time
- **Throughput**: Tokens per second (higher is better)
- **Error Rate**: Percentage of failed requests

#### Recent Tab
Shows the last 10 messages with detailed metrics:
- TTFT, Total time, Network latency, Backend processing
- Tokens per second and response length
- Retry counts (if any)
- Error information (if failed)

#### By Model Tab
Performance statistics grouped by model:
- Average TTFT per model
- Average total time per model
- Number of messages per model

### 4. Export Data

Click the **Download icon** in the top-right of the panel to export all metrics as JSON for further analysis.

## What the Metrics Tell You

### If TTFT is High (> 3 seconds)
**Problem**: Model is slow to start responding

**Possible causes**:
- Model cold start (model not pre-loaded)
- Backend processing delay
- Model provider infrastructure issues

**Solutions**:
- Use faster models for simple queries
- Implement model pre-warming
- Switch to a different provider

### If Total Time is High but TTFT is Low
**Problem**: Streaming is slow

**Possible causes**:
- Low tokens per second (< 20 TPS)
- Very long response
- Network congestion

**Solutions**:
- Use models with better throughput
- Implement response length limits
- Check network connection

### If Network Latency is High (> 200ms)
**Problem**: Network connection is slow

**Possible causes**:
- Distance to server
- Poor internet connection
- Network congestion

**Solutions**:
- Use CDN/edge deployment
- Improve user's network
- Implement request compression

### If Backend Processing is High (> 500ms)
**Problem**: Backend is taking too long to process

**Possible causes**:
- Database queries
- Authentication checks
- API calls to upstream services

**Solutions**:
- Optimize backend code
- Add caching
- Use connection pooling

## Architecture

### Files
- `src/lib/chat-performance-tracker.ts` - Core tracking utility
- `src/lib/streaming.ts` - Enhanced with timing metadata
- `src/app/api/chat/completions/route.ts` - API timing headers
- `src/app/chat/page.tsx` - Integration in chat page
- `src/components/chat/performance-monitor.tsx` - UI component

### How It Works

1. **Start Tracking**: When user clicks send, `chatPerformanceTracker.startTracking()` is called
2. **Mark Request Start**: When API request begins, `markRequestStart()` records timestamp
3. **First Token**: When first content chunk arrives, `markFirstToken()` calculates TTFT
4. **Timing Metadata**: API route sends timing headers (backend time, network time)
5. **Stream Complete**: When streaming finishes, `markStreamComplete()` calculates totals
6. **Error Tracking**: Any errors are recorded with `recordError()`

### Performance Impact

The monitoring system is designed to have minimal impact:
- Only enabled in development mode
- Uses `performance.now()` for high-precision timing
- Metrics stored in memory (auto-cleaned to prevent leaks)
- UI updates throttled to prevent excessive re-renders

## Example Output

```json
{
  "metrics": [
    {
      "messageId": "msg-1234567890-abc123",
      "model": "openai/gpt-4",
      "gateway": "openrouter",
      "timeToFirstToken": 1523,
      "totalResponseTime": 8456,
      "networkLatency": 142,
      "backendProcessingTime": 89,
      "tokensPerSecond": 45.2,
      "messageLength": 128,
      "responseLength": 2048,
      "hadError": false,
      "retryCount": 0
    }
  ],
  "averages": {
    "avgTTFT": 1523,
    "avgTotalTime": 8456,
    "avgTokensPerSecond": 45.2,
    "totalMessages": 1,
    "errorRate": 0
  }
}
```

## Tips for Optimization

1. **Track Across Different Models**: Compare performance to find the fastest models
2. **Monitor During Peak Times**: Check if performance degrades under load
3. **Export Data Regularly**: Build a historical performance database
4. **Set Baselines**: Establish what "good" performance looks like
5. **Track After Changes**: Measure impact of optimizations

## Troubleshooting

### Monitor Not Showing
- Check that `NODE_ENV === 'development'`
- Look for console errors in browser DevTools
- Verify you're on the `/chat` page

### Metrics Not Tracking
- Check console for "🔍 [Performance]" log messages
- Verify streaming is working correctly
- Check for JavaScript errors

### Inaccurate Timings
- Clear browser cache and reload
- Check for browser extensions interfering
- Verify system clock is accurate

## Future Enhancements

Potential improvements to consider:
- [ ] Production-safe monitoring with sampling
- [ ] Backend persistence of metrics
- [ ] Real-time alerts for slow responses
- [ ] Comparison charts (model A vs model B)
- [ ] Geographic latency tracking
- [ ] Integration with analytics platforms
