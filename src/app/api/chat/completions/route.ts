import { NextRequest } from 'next/server';
import { traced, wrapTraced } from 'braintrust';
import { isBraintrustEnabled } from '@/lib/braintrust';

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

      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': apiKey,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });

      console.log('[API Proxy] Response status:', response.status);
      console.log('[API Proxy] Response ok:', response.ok);

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
  let timeoutMs = 30000; // Default timeout

  try {
    const body = await request.json();
    const apiKey = request.headers.get('authorization');

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

    // Process completion with Braintrust tracing
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
