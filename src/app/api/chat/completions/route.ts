import { NextRequest } from 'next/server';
import { traced, wrapTraced } from 'braintrust';
import { isBraintrustEnabled } from '@/lib/braintrust';
import { normalizeModelId } from '@/lib/utils';

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

      console.log('[API Proxy] Forwarding request to:', targetUrl);
      console.log('[API Proxy] Model:', body.model);
      console.log('[API Proxy] Stream:', body.stream);

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

        console.log('[API Proxy] Response status:', response.status);
        console.log('[API Proxy] Response ok:', response.ok);
        console.log('[API Proxy] Response headers:', Object.fromEntries(response.headers.entries()));
        console.log('[API Proxy] Response body exists:', !!response.body);

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

      console.log('[API Proxy] Setting up streaming response forwarding');
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
  console.log('[API Proxy] POST request received');
  let timeoutMs = 30000; // Default timeout

  try {
    console.log('[API Proxy] Parsing request body...');
    const body = await request.json();

    // Normalize model ID to handle different formats from various gateway APIs
    if (body.model) {
      const originalModel = body.model;
      body.model = normalizeModelId(body.model);
      if (originalModel !== body.model) {
        console.log('[API Proxy] Normalized model ID from', originalModel, 'to', body.model);
      }
    }

    console.log('[API Proxy] Request body parsed, model:', body.model, 'stream:', body.stream);

    const apiKey = request.headers.get('authorization');
    console.log('[API Proxy] API key present:', !!apiKey);
    if (apiKey) {
      const keyPrefix = apiKey.substring(0, 15);
      console.log('[API Proxy] API key prefix:', keyPrefix);
      console.log('[API Proxy] Is temp key?', apiKey.includes('gw_temp_'));
      console.log('[API Proxy] Is live key?', apiKey.includes('gw_live_'));
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

    // Use a 120 second timeout for streaming requests (models can be slow to start)
    // Use a 30 second timeout for non-streaming requests
    timeoutMs = body.stream ? 120000 : 30000;

    // For streaming requests, bypass Braintrust to avoid interference with the stream
    if (body.stream) {
      console.log('[API Proxy] Handling streaming request directly (bypassing Braintrust)');
      console.log('[API Proxy] Target URL:', targetUrl.toString());

      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);

      try {
        const requestStartTime = Date.now();
        console.log('[API Proxy] Making fetch request to backend');
        console.log('[API Proxy] Target URL:', targetUrl.toString());
        console.log('[API Proxy] Request headers:', {
          'Content-Type': 'application/json',
          'Authorization': apiKey ? apiKey.substring(0, 20) + '...' : 'none'
        });

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

        console.log('[API Proxy] Streaming response received');
        console.log('[API Proxy] Response time:', responseTime + 'ms');
        console.log('[API Proxy] Response status:', response.status);
        console.log('[API Proxy] Response ok:', response.ok);
        console.log('[API Proxy] Content-Type:', response.headers.get('content-type'));
        console.log('[API Proxy] Response body exists:', !!response.body);

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

        console.log('[API Proxy] Returning streaming response to client');
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
      details = `Request to backend API timed out after ${timeoutMs / 1000} seconds. The model may be overloaded or starting up. Please try again in a moment.`;
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
