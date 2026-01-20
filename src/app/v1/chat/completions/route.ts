import { NextRequest } from 'next/server';
import { traced, wrapTraced } from 'braintrust';
import { isBraintrustEnabled } from '@/lib/braintrust';
import { normalizeModelId } from '@/lib/utils';

// Enable debug logging only in development
const DEBUG = process.env.NODE_ENV === 'development';
const debug = (...args: any[]) => DEBUG && console.log('[API Proxy]', ...args);

/**
 * Process LLM completion with Braintrust tracing
 */
const processCompletion = wrapTraced(
  async function processCompletion(
    body: any,
    apiKey: string,
    targetUrl: string,
    timeoutMs: number
  ) {
    return traced(async (span) => {
      const startTime = Date.now();

      debug('Forwarding request to:', targetUrl);
      debug('Model:', body.model, 'Stream:', body.stream);

      // Create an AbortController for timeout handling (AbortSignal.timeout may not be available)
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);

      try {
        const response = await fetch(targetUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': apiKey,
          },
          body: JSON.stringify(body),
          signal: abortController.signal,
        });

        clearTimeout(timeoutId);

        debug('Response:', response.status, response.ok ? 'OK' : 'ERROR');

      // If not streaming, parse and log the response
      if (!body.stream) {
        const contentType = response.headers.get('content-type');

        // Try to parse JSON response
        let data;
        try {
          data = await response.json();
        } catch (parseError) {
          console.error('[API Proxy] Failed to parse JSON response:', parseError);
          const text = await response.text();
          console.error('[API Proxy] Response text:', text);

          throw new Error(`Invalid response from backend: ${text || 'Could not parse backend response'}`);
        }

        // Extract metrics from response
        const promptTokens = data.usage?.prompt_tokens || 0;
        const completionTokens = data.usage?.completion_tokens || 0;
        const totalTokens = data.usage?.total_tokens || promptTokens + completionTokens;
        const latency = Date.now() - startTime;

        // Log to Braintrust
        if (isBraintrustEnabled()) {
          span.log({
            input: body.messages || [{ role: 'user', content: body.prompt || '' }],
            output: data.choices?.[0]?.message?.content || data.choices?.[0]?.text || '',
            metrics: {
              prompt_tokens: promptTokens,
              completion_tokens: completionTokens,
              tokens: totalTokens,
              latency_ms: latency,
            },
            metadata: {
              model: body.model,
              temperature: body.temperature,
              max_tokens: body.max_tokens,
              top_p: body.top_p,
              frequency_penalty: body.frequency_penalty,
              presence_penalty: body.presence_penalty,
              stream: body.stream,
              response_status: response.status,
            },
          });
        }

        return { data, status: response.status };
      }

      // For streaming responses, we'll log basic info and return the stream
      if (!response.body) {
        throw new Error('No response body for streaming response');
      }

      // Log streaming request to Braintrust (without output since it's streaming)
      if (isBraintrustEnabled()) {
        span.log({
          input: body.messages || [{ role: 'user', content: body.prompt || '' }],
          metadata: {
            model: body.model,
            temperature: body.temperature,
            max_tokens: body.max_tokens,
            top_p: body.top_p,
            stream: true,
            response_status: response.status,
          },
        });
      }

      debug('Setting up streaming response forwarding');
      return { stream: response.body, status: response.status };
      } catch (fetchError) {
        clearTimeout(timeoutId);
        throw fetchError;
      }
    });
  },
  {
    type: 'llm',
    name: 'Gatewayz Chat Completion',
  }
);

/**
 * API Proxy for Chat Completions
 * This proxies requests to the Gatewayz API to bypass CORS issues in development
 */
export async function POST(request: NextRequest) {
  debug('POST request received');
  let timeoutMs = 30000; // Default timeout

  try {
    const body = await request.json();

    // Normalize model ID to handle different formats from various gateway APIs
    if (body.model) {
      const originalModel = body.model;
      body.model = normalizeModelId(body.model);
      if (originalModel !== body.model) {
        debug('Normalized model ID from', originalModel, 'to', body.model);
      }
    }

    debug('Request:', body.model, body.stream ? 'streaming' : 'non-streaming');

    const apiKey = request.headers.get('authorization');
    if (!apiKey && DEBUG) {
      debug('No API key provided');
    }

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'No authorization header provided' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.gatewayz.ai';
    const targetUrl = new URL(`${apiUrl}/v1/chat/completions`);

    // Forward any query parameters (e.g., session_id)
    request.nextUrl.searchParams.forEach((value, key) => {
      targetUrl.searchParams.append(key, value);
    });

    // Use longer timeouts for large models (30B+ parameters) or NEAR provider
    // NEAR models and very large models can take 3-5 minutes to load and start responding
    const isLargeModel = body.model?.includes('30B') || body.model?.includes('70B') || body.model?.includes('405B');
    const isNearProvider = body.model?.startsWith('near/');
    const needsExtendedTimeout = isLargeModel || isNearProvider;

    // Use a 300 second (5 minute) timeout for large/NEAR models
    // Use a 120 second (2 minute) timeout for regular streaming requests
    // Use a 30 second timeout for non-streaming requests
    if (body.stream) {
      timeoutMs = needsExtendedTimeout ? 300000 : 120000;
    } else {
      timeoutMs = needsExtendedTimeout ? 180000 : 30000;
    }

    // For streaming requests, bypass Braintrust to avoid interference with the stream
    if (body.stream) {
      debug('Streaming request, timeout:', `${timeoutMs / 1000}s`, needsExtendedTimeout ? '[EXTENDED]' : '[STANDARD]');

      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);

      try {
        const requestStartTime = Date.now();

        const response = await fetch(targetUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': apiKey,
            'Accept': 'text/event-stream',
          },
          body: JSON.stringify(body),
          signal: abortController.signal,
        });

        clearTimeout(timeoutId);
        const responseTime = Date.now() - requestStartTime;

        debug('Streaming response:', response.status, `${responseTime}ms`);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[API Proxy] Backend returned error status:', response.status);
          console.error('[API Proxy] Error response text:', errorText.substring(0, 500));
          console.error('[API Proxy] Error response (first 1000 chars):', errorText.substring(0, 1000));
          console.error('[API Proxy] Full request body:', JSON.stringify(body, null, 2));

          // Try to parse the error as JSON
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { raw: errorText };
          }

          // Log the actual model ID being sent to help debug
          console.error('[API Proxy] Model ID sent to backend:', body.model);
          console.error('[API Proxy] Gateway param sent to backend:', body.gateway);

          return new Response(JSON.stringify({
            error: 'Backend API Error',
            status: response.status,
            statusText: response.statusText,
            message: errorData.message || errorData.detail || errorText.substring(0, 500),
            model: body.model,
            gateway: body.gateway,
            errorData: errorData
          }), {
            status: response.status,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if (!response.body) {
          console.error('[API Proxy] No response body for streaming request');
          return new Response(
            JSON.stringify({ error: 'No response body from backend' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
          );
        }

        debug('Returning streaming response to client');
        return new Response(response.body, {
          status: response.status,
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        });
      } catch (fetchError) {
        clearTimeout(timeoutId);
        console.error('[API Proxy] Fetch error for streaming request:', fetchError);
        throw fetchError;
      }
    }

    // For non-streaming requests, use Braintrust tracing
    const result = await processCompletion(body, apiKey, targetUrl.toString(), timeoutMs);

    // Handle non-streaming response
    if ('data' in result) {
      return new Response(JSON.stringify(result.data), {
        status: result.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Handle streaming response
    if ('stream' in result) {
      return new Response(result.stream, {
        status: result.status,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // Fallback error
    return new Response(
      JSON.stringify({ error: 'Unexpected response format' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[API Proxy] Error:', error);

    // Extract more detailed error information
    const errorDetails = error instanceof Error ? {
      message: error.message,
      name: error.name,
      cause: (error as any).cause,
      stack: error.stack
    } : { message: 'Unknown error', name: 'UnknownError' };

    // Determine appropriate status code based on error type
    let status = 500;
    let details = 'Failed to proxy request to chat completions API';

    if (errorDetails.name === 'TimeoutError' || errorDetails.message.includes('timeout') || errorDetails.message.includes('timed out')) {
      status = 504;
      const timeoutMinutes = Math.floor(timeoutMs / 60000);
      const timeoutSeconds = Math.floor((timeoutMs % 60000) / 1000);
      const timeoutDisplay = timeoutMinutes > 0
        ? `${timeoutMinutes} minute${timeoutMinutes > 1 ? 's' : ''}${timeoutSeconds > 0 ? ` ${timeoutSeconds} seconds` : ''}`
        : `${timeoutSeconds} seconds`;
      details = `Request to backend API timed out after ${timeoutDisplay}. The model may be overloaded or starting up. Please try again in a moment.`;
    } else if (errorDetails.message.includes('fetch') || errorDetails.message.includes('network') || errorDetails.name === 'TypeError') {
      status = 502;
      details = 'Could not connect to backend API. The service may be temporarily unavailable.';
    }

    return new Response(
      JSON.stringify({
        error: errorDetails.message,
        errorName: errorDetails.name,
        details: details,
        cause: errorDetails.cause,
        suggestion: 'The backend API may be experiencing issues. Try again in a moment or use a different model.',
        apiUrl: process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.gatewayz.ai'
      }),
      { status, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
