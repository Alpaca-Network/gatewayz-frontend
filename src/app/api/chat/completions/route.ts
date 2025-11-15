import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/app/api/middleware/error-handler';
import { API_BASE_URL } from '@/lib/config';
import { normalizeModelId } from '@/lib/utils';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const apiKey = body.apiKey || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

    // Normalize @provider format model IDs (e.g., @google/models/gemini-pro → google/gemini-pro)
    const originalModel = body.model;
    const normalizedModel = normalizeModelId(body.model);
    if (originalModel !== normalizedModel) {
      console.log('[API Completions] Normalized model ID from', originalModel, 'to', normalizedModel);
    }
    body.model = normalizedModel;

    console.log('Chat completions API route - Request:', {
      model: body.model,
      hasMessages: !!body.messages,
      messageCount: body.messages?.length || 0,
      stream: body.stream,
      hasApiKey: !!apiKey,
    });

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key required' },
        { status: 401 }
      );
    }

    // Extract session_id from query parameters
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session_id');

    // Build the backend URL with session_id if provided
    let url = `${API_BASE_URL}/v1/chat/completions`;
    if (sessionId) {
      url += `?session_id=${sessionId}`;
    }

    console.log(`Chat completions API route - Calling: ${url}`);
    console.log(`Chat completions API route - Stream mode: ${body.stream}`);

    // Forward the request to the backend
    const backendRequestBody: any = {
      model: body.model,
      messages: body.messages,
      stream: body.stream,
    };

    // Add optional parameters
    if (body.max_tokens) {
      backendRequestBody.max_tokens = body.max_tokens;
    }
    if (body.temperature !== undefined) {
      backendRequestBody.temperature = body.temperature;
    }
    if (body.top_p !== undefined) {
      backendRequestBody.top_p = body.top_p;
    }
    if (body.frequency_penalty !== undefined) {
      backendRequestBody.frequency_penalty = body.frequency_penalty;
    }
    if (body.presence_penalty !== undefined) {
      backendRequestBody.presence_penalty = body.presence_penalty;
    }
    if (body.gateway) {
      backendRequestBody.gateway = body.gateway;
    }
    if (body.portkey_provider) {
      backendRequestBody.portkey_provider = body.portkey_provider;
    }

    let response: Response;
    const maxRetries = 5;
    let lastError: Error | null = null;

    // Retry logic for network errors and rate limits
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Add AbortController for timeout (6 minutes max for streaming)
        // This prevents infinite hangs on backend API failures
        const fetchController = new AbortController();
        const fetchTimeoutId = setTimeout(() => fetchController.abort(), 360000); // 6 minutes

        response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'Connection': 'keep-alive', // Enable connection pooling
          },
          body: JSON.stringify(backendRequestBody),
          signal: fetchController.signal, // Add abort signal for timeout
        });

        clearTimeout(fetchTimeoutId);

        // Check for rate limit (429) and retry with exponential backoff
        if (response.status === 429 && attempt < maxRetries) {
          const retryAfterHeader = response.headers.get('retry-after');
          let waitTime = 1000 * Math.pow(2, attempt); // 1s, 2s, 4s, 8s, 16s, 32s

          // Honor Retry-After header if present
          if (retryAfterHeader) {
            const numericRetry = Number(retryAfterHeader);
            if (!Number.isNaN(numericRetry) && numericRetry > 0) {
              waitTime = Math.max(waitTime, numericRetry * 1000);
            }
          }

          // Add small jitter to prevent thundering herd
          const jitter = Math.floor(Math.random() * 100);
          const totalWaitTime = waitTime + jitter;

          console.log(`Chat completions API route - Rate limit (429), retrying in ${totalWaitTime}ms (attempt ${attempt + 1}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, totalWaitTime));
          continue;
        }

        break; // Success or non-retryable error, exit retry loop
      } catch (fetchError) {
        lastError = fetchError instanceof Error ? fetchError : new Error(String(fetchError));

        // Check if it's a timeout or network error
        const isTimeoutError = fetchError instanceof Error && fetchError.name === 'AbortError';
        const isNetworkError = isTimeoutError || fetchError instanceof TypeError ||
          (fetchError instanceof Error && (
            fetchError.message.includes('fetch') ||
            fetchError.message.includes('network') ||
            fetchError.message.includes('ECONNREFUSED') ||
            fetchError.message.includes('ECONNRESET') ||
            fetchError.message.includes('ETIMEDOUT')
          ));

        if (isNetworkError && attempt < maxRetries) {
          const waitTime = 2000 * Math.pow(2, attempt); // 2s, 4s, 8s, 16s, 32s, 64s
          const errorType = isTimeoutError ? 'timeout' : 'network';
          console.log(`Chat completions API route - ${errorType} error, retrying in ${waitTime}ms (attempt ${attempt + 1}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }

        // Non-network error or max retries exceeded
        console.error('Chat completions API route - Fetch failed:', fetchError);
        return NextResponse.json(
          {
            error: isNetworkError
              ? `Backend connection failed after ${maxRetries + 1} attempts. Please try again.`
              : 'Failed to connect to backend API',
            details: lastError.message
          },
          { status: 503 }
        );
      }
    }

    console.log(`Chat completions API route - Response status:`, response!.status);

    if (!response!.ok) {
      const errorText = await response!.text();
      console.log(`Chat completions API route - Backend error:`, errorText);

      // For 429 errors, include retry-after headers from backend if available
      const headers: Record<string, string> = {};
      const retryAfter = response!.headers.get('retry-after');
      if (retryAfter && response!.status === 429) {
        headers['retry-after'] = retryAfter;
      }

      return NextResponse.json(
        { error: `Backend API error: ${response!.status}`, details: errorText },
        { status: response!.status, headers }
      );
    }

    // For streaming responses, forward the stream directly
    if (body.stream) {
      console.log('Chat completions API route - Streaming response...');

      // OPTIMIZATION: Return streaming response with optimized Edge Runtime headers
      // Connection pooling and low buffering for fast response
      return new NextResponse(response!.body, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          'X-Accel-Buffering': 'no',
          'Connection': 'keep-alive', // Maintain connection for streaming
          'Transfer-Encoding': 'chunked', // Enable chunked encoding for responsiveness
          'X-Content-Type-Options': 'nosniff', // Security header
        },
      });
    }

    // For non-streaming responses, parse and return JSON
    const data = await response!.json();
    console.log('Chat completions API route - Success!');

    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error, 'Chat Completions API');
  }
}
