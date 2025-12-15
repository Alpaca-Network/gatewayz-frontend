import { NextRequest, NextResponse } from 'next/server';
import { profiler, generateRequestId } from '@/lib/performance-profiler';
import { normalizeModelId } from '@/lib/utils';
import { API_BASE_URL } from '@/lib/config';
import { handleApiError } from '@/app/api/middleware/error-handler';
import {
  getClientIP,
  checkGuestRateLimit,
  incrementGuestRateLimit,
  formatResetTime,
  getGuestDailyLimit,
} from '@/lib/guest-rate-limiter';

/**
 * Calculate retry delay for rate limit errors with exponential backoff
 */
function calculateRetryDelay(
  retryCount: number,
  retryAfterHeader: string | null,
  isBurstLimit: boolean
): number {
  // Base delay: longer for burst limits, shorter for regular rate limits
  const baseDelay = isBurstLimit ? 2000 : 1000;
  const maxDelay = isBurstLimit ? 30000 : 10000;
  
  // Exponential backoff: baseDelay * 2^retryCount
  let waitTime = Math.min(baseDelay * Math.pow(2, retryCount), maxDelay);
  
  // Parse Retry-After header if present
  if (retryAfterHeader) {
    const numericRetry = Number(retryAfterHeader);
    if (!Number.isNaN(numericRetry) && numericRetry > 0) {
      // Retry-After is in seconds
      waitTime = Math.max(waitTime, numericRetry * 1000);
    } else {
      // Try parsing as HTTP date
      const retryDate = Date.parse(retryAfterHeader);
      if (!Number.isNaN(retryDate)) {
        const headerWait = retryDate - Date.now();
        if (headerWait > 0) {
          waitTime = Math.max(waitTime, headerWait);
        }
      }
    }
  }
  
  // Ensure minimum delay
  waitTime = Math.max(waitTime, 1000);
  
  // Add jitter to prevent thundering herd
  const jitter = Math.floor(Math.random() * 500);
  waitTime += jitter;
  
  return waitTime;
}

/**
 * Sleep helper for retries
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Process LLM completion without tracing
 */
async function processCompletion(
  body: any,
  apiKey: string,
  targetUrl: string,
  timeoutMs: number
) {
  const startTime = Date.now();
  const maxRetries = 3;
  let lastError: { status: number; errorData: any; retryAfter: string | null } | null = null;

  console.log('[API Proxy] Forwarding request to:', targetUrl);
  console.log('[API Proxy] Model:', body.model);
  console.log('[API Proxy] Stream:', body.stream);

      for (let retryCount = 0; retryCount <= maxRetries; retryCount++) {
        // Create an AbortController for timeout handling (AbortSignal.timeout may not be available)
        const abortController = new AbortController();
        const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);

        try {
          if (retryCount > 0) {
            const waitTime = calculateRetryDelay(
              retryCount - 1,
              lastError?.retryAfter || null,
              lastError?.errorData?.detail?.toLowerCase().includes('burst') || false
            );
            console.log(`[API Proxy] Retry attempt ${retryCount}/${maxRetries} after ${waitTime}ms delay`);
            await sleep(waitTime);
          }

          const response = await fetch(targetUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify(body),
            signal: abortController.signal,
          });

          clearTimeout(timeoutId);

          console.log('[API Proxy] Response status:', response.status);
          console.log('[API Proxy] Response ok:', response.ok);
          console.log('[API Proxy] Response headers:', Object.fromEntries(response.headers.entries()));
          console.log('[API Proxy] Response body exists:', !!response.body);

          // Handle rate limit errors with retry
          if (response.status === 429) {
            const errorText = await response.text();
            let errorData;
            try {
              errorData = JSON.parse(errorText);
            } catch {
              errorData = { raw: errorText };
            }

            const retryAfter = response.headers.get('retry-after');
            const isBurstLimit = errorData.detail?.toLowerCase().includes('burst') || false;

            console.warn(`[API Proxy] Rate limit error (429) on attempt ${retryCount + 1}/${maxRetries + 1}`);
            console.warn('[API Proxy] Error detail:', errorData.detail || errorData.message);
            console.warn('[API Proxy] Retry-After header:', retryAfter || 'not present');
            console.warn('[API Proxy] Is burst limit:', isBurstLimit);

            if (retryCount < maxRetries) {
              lastError = { status: 429, errorData, retryAfter };
              // Use isBurstLimit for logging context
              console.log(`[API Proxy] Will retry (burst limit: ${isBurstLimit})`);
              continue; // Retry
            } else {
              // Max retries exceeded
              throw new Error(`Rate limit exceeded after ${maxRetries + 1} attempts: ${errorData.detail || errorData.message || 'Rate limit exceeded'}`);
            }
          }

          // If not streaming, parse and log the response
          if (!body.stream) {
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

        console.log('[API Proxy] Response metrics:', {
          promptTokens,
          completionTokens,
          totalTokens,
          latency
        });

        return { data, status: response.status };
          }

      // For streaming responses, we'll log basic info and return the stream
      if (!response.body) {
        throw new Error('No response body for streaming response');
      }

      console.log('[API Proxy] Setting up streaming response forwarding');
      return { stream: response.body, status: response.status };
    } catch (fetchError) {
      clearTimeout(timeoutId);

      // Don't retry on abort/timeout errors
      if (fetchError instanceof Error && (
        fetchError.name === 'AbortError' ||
        fetchError.message.includes('aborted') ||
        fetchError.message.includes('timeout')
      )) {
        console.error('[API Proxy] Request aborted/timed out, not retrying:', fetchError);
        throw fetchError;
      }

      // Retry on network errors if we haven't exceeded max retries
      if (retryCount < maxRetries) {
        console.warn(`[API Proxy] Fetch error on attempt ${retryCount + 1}, will retry:`, fetchError);
        await sleep(calculateRetryDelay(retryCount, null, false));
        continue;
      }

      throw fetchError;
    }
  }

  // Should never reach here, but TypeScript needs it
  throw new Error('Unexpected error in processCompletion');
}

/**
 * API Proxy for Chat Completions
 * This proxies requests to the Gatewayz API to bypass CORS issues in development
 */
export async function POST(request: NextRequest) {
  const requestId = generateRequestId();
  const requestStartTime = performance.now();
  
  console.log(`[API Proxy] POST request received [${requestId}]`);
  profiler.startRequest(requestId, {
    method: 'POST',
    url: request.url,
    userAgent: request.headers.get('user-agent'),
  });
  
  let timeoutMs = 30000; // Default timeout

  try {
    profiler.markStage(requestId, 'parse_request_body');
    console.log('[API Proxy] Parsing request body...');
    const body = await request.json();
    console.log('[API Proxy] Request body parsed, model:', body.model, 'stream:', body.stream);
    
    profiler.markStage(requestId, 'validate_auth', {
      model: body.model,
      stream: body.stream,
      messageCount: body.messages?.length || 0,
    });

    // Extract API key and session ID
    let apiKey = body.apiKey || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session_id');

    // Determine if this is an explicit guest request vs missing/invalid API key
    const isExplicitGuestRequest = apiKey === 'guest';
    const isMissingApiKey = !apiKey || apiKey.trim() === '';
    const isGuestRequest = isExplicitGuestRequest || isMissingApiKey;

    // For explicit guest requests or missing API key, check rate limit and use the guest API key
    if (isGuestRequest) {
      const guestKey = process.env.GUEST_API_KEY;
      const clientIP = getClientIP(request);

      // Check guest rate limit (3 messages per 24 hours per IP)
      const rateLimitCheck = checkGuestRateLimit(clientIP);

      if (!rateLimitCheck.allowed) {
        // Guest has exceeded daily limit
        const resetTime = formatResetTime(rateLimitCheck.resetInMs);
        console.warn(`[API Completions] Guest rate limit exceeded for IP: ${clientIP}`);

        return new Response(JSON.stringify({
          error: 'Daily limit reached',
          code: 'GUEST_RATE_LIMIT_EXCEEDED',
          message: `You've used all ${getGuestDailyLimit()} free messages for today. Sign up for a free account to continue chatting!`,
          detail: `Your guest message limit will reset in ${resetTime}.`,
          remaining: 0,
          limit: rateLimitCheck.limit,
          resetInMs: rateLimitCheck.resetInMs,
        }), {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': String(rateLimitCheck.limit),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.ceil(rateLimitCheck.resetInMs / 1000)),
            'Retry-After': String(Math.ceil(rateLimitCheck.resetInMs / 1000)),
          },
        });
      }

      if (!guestKey) {
        // Guest mode is not configured - return a helpful error
        console.warn('[API Completions] Guest mode attempted but GUEST_API_KEY not configured');
        return new Response(JSON.stringify({
          error: 'Guest mode not available',
          code: 'GUEST_NOT_CONFIGURED',
          message: 'Please sign in to use the chat feature. Create a free account to get started!',
          detail: 'Guest chat is temporarily unavailable. Sign up for a free account to continue.'
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Increment rate limit counter immediately to prevent abuse via failed requests
      const rateLimitResult = incrementGuestRateLimit(clientIP);

      console.log('[API Completions] Guest mode detected:', {
        isExplicitGuestRequest,
        isMissingApiKey,
        clientIP,
        remaining: rateLimitResult.remaining,
        usingKey: guestKey.substring(0, 15) + '...'
      });
      apiKey = guestKey;
    }

    // Resolve router models to actual model IDs
    // The "openrouter/auto" model is a special router that auto-selects the best model.
    // Since the backend doesn't support auto-routing, we need to select a fallback model.
    if (body.model === 'openrouter/auto' || body.model === 'auto-router') {
      const fallbackModel = 'openai/gpt-4o-mini';
      console.log(`[API Completions] Router model "${body.model}" resolved to fallback: ${fallbackModel}`);
      body.model = fallbackModel;
    }

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
      isGuestRequest,
      apiKeyPrefix: apiKey ? apiKey.substring(0, 10) + '...' : 'none',
    });

    profiler.markStage(requestId, 'prepare_backend_request');
    const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.gatewayz.ai';
    const targetUrl = new URL(`${apiUrl}/v1/chat/completions`);

    // Add session_id to the backend URL if provided
    if (sessionId) {
      targetUrl.searchParams.set('session_id', sessionId);
    }

    // Use a 180 second timeout for streaming requests (models can be slow to start, especially with reasoning)
    // Use a 60 second timeout for non-streaming requests
    timeoutMs = body.stream ? 180000 : 60000;
    
    profiler.markStage(requestId, 'timeout_configured', {
      timeoutMs,
      targetUrl: targetUrl.toString(),
    });

    // For streaming requests, bypass Braintrust to avoid interference with the stream
    if (body.stream) {
      console.log('[API Proxy] Handling streaming request directly (bypassing Braintrust)');
      console.log('[API Proxy] Target URL:', targetUrl.toString());

      // Retry logic for streaming requests
      const maxRetries = 3;
      let lastError: { status: number; errorData: any; retryAfter: string | null } | null = null;

      for (let retryCount = 0; retryCount <= maxRetries; retryCount++) {
        const abortController = new AbortController();
        const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);

        try {
          if (retryCount > 0) {
            const waitTime = calculateRetryDelay(
              retryCount - 1,
              lastError?.retryAfter || null,
              lastError?.errorData?.detail?.toLowerCase().includes('burst') || false
            );
            console.log(`[API Proxy] Retry attempt ${retryCount}/${maxRetries} after ${waitTime}ms delay`);
            profiler.markStage(requestId, 'rate_limit_retry', {
              retryCount,
              waitTime,
            });
            await sleep(waitTime);
          }

          profiler.markStage(requestId, 'backend_fetch_start', { retryCount });
          const backendRequestStartTime = Date.now();
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
              'Authorization': `Bearer ${apiKey}`,
              'Accept': 'text/event-stream',
            },
            body: JSON.stringify(body),
            signal: abortController.signal,
          });

          clearTimeout(timeoutId);
          const backendResponseTime = Date.now() - backendRequestStartTime;
          profiler.markStage(requestId, 'backend_response_received', {
            backendResponseTime,
            status: response.status,
            contentType: response.headers.get('content-type'),
            retryCount,
          });

          console.log('[API Proxy] Streaming response received');
          console.log(`[API Proxy] Backend response time: ${backendResponseTime}ms`);
          console.log('[API Proxy] Response status:', response.status);
          console.log('[API Proxy] Response ok:', response.ok);
          console.log('[API Proxy] Content-Type:', response.headers.get('content-type'));
          console.log('[API Proxy] Response body exists:', !!response.body);
          console.log('[API Proxy] Response body readable:', response.body?.locked === false);
          console.log('[API Proxy] Response headers:', {
            contentType: response.headers.get('content-type'),
            transferEncoding: response.headers.get('transfer-encoding'),
            contentLength: response.headers.get('content-length'),
            connection: response.headers.get('connection'),
          });

          // Handle rate limit errors with retry
          if (response.status === 429) {
            const errorText = await response.text();
            let errorData;
            try {
              errorData = JSON.parse(errorText);
            } catch {
              errorData = { raw: errorText };
            }

            const retryAfter = response.headers.get('retry-after');
            const isBurstLimit = errorData.detail?.toLowerCase().includes('burst') || false;

            console.warn(`[API Proxy] Rate limit error (429) on attempt ${retryCount + 1}/${maxRetries + 1}`);
            console.warn('[API Proxy] Error detail:', errorData.detail || errorData.message);
            console.warn('[API Proxy] Retry-After header:', retryAfter || 'not present');
            console.warn('[API Proxy] Is burst limit:', isBurstLimit);

            if (retryCount < maxRetries) {
              lastError = { status: 429, errorData, retryAfter };
              continue; // Retry - delay already calculated in next iteration
            } else {
              // Max retries exceeded
              console.error('[API Proxy] Max retries exceeded for rate limit');
              return new Response(JSON.stringify({
                error: 'Rate Limit Exceeded',
                status: 429,
                statusText: 'Too Many Requests',
                message: errorData.detail || errorData.message || 'Rate limit exceeded. Please wait before trying again.',
                model: body.model,
                gateway: body.gateway,
                errorData: errorData,
                retryAfter: retryAfter,
                retriesExhausted: true,
              }), {
                status: 429,
                headers: {
                  'Content-Type': 'application/json',
                  'Retry-After': retryAfter || '60',
                },
              });
            }
          }

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

            // Provide user-friendly error messages for common status codes
            let userMessage = errorData.message || errorData.detail || errorText.substring(0, 500);
            let errorType = 'api_error';

            if (response.status === 401 || response.status === 403) {
              userMessage = 'Your session has expired. Please log out and log back in to continue.';
              errorType = 'auth_error';
            } else if (response.status === 429) {
              userMessage = errorData.detail || errorData.message || 'Rate limit exceeded. Please wait a moment and try again.';
              errorType = 'rate_limit_error';
            }

            return new Response(JSON.stringify({
              error: 'Backend API Error',
              status: response.status,
              statusText: response.statusText,
              message: userMessage,
              type: errorType,
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

          // Verify body is readable
          if (response.body.locked) {
            console.error('[API Proxy] Response body is locked (already being read)');
            return new Response(
              JSON.stringify({ error: 'Response stream locked - unable to read' }),
              { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
          }

          // For streaming responses, we need to ensure the response is properly formatted
          // Wrap the stream to add debugging and ensure proper SSE format
          const wrappedStream = response.body.pipeThrough(
            new TransformStream({
              transform(chunk, controller) {
                // Log chunk for debugging
                const text = new TextDecoder().decode(chunk);
                if (text.length > 0) {
                  console.log('[API Proxy] Chunk received from backend:', text.substring(0, 200));
                }
                controller.enqueue(chunk);
              },
            })
          );

          profiler.markStage(requestId, 'stream_response_ready');
          console.log('[API Proxy] Returning streaming response to client');
          profiler.endRequest(requestId);
          console.log(`[API Proxy] Request ${requestId} complete. Total time: ${(performance.now() - requestStartTime).toFixed(2)}ms`);

          // Calculate timing metrics for performance tracking
          const totalTime = performance.now() - requestStartTime;
          const backendTime = backendResponseTime; // Time it took for backend to respond

          // Build response headers
          const responseHeaders: Record<string, string> = {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Request-ID': requestId,
            'X-Response-Time': `${totalTime.toFixed(2)}ms`,
            'X-Backend-Time': `${backendTime.toFixed(2)}ms`,
            'X-Network-Time': `${(totalTime - backendTime).toFixed(2)}ms`,
          };

          // Add guest rate limit headers if applicable
          if (isGuestRequest) {
            const clientIP = getClientIP(request);
            const rateLimitInfo = checkGuestRateLimit(clientIP);
            responseHeaders['X-RateLimit-Limit'] = String(rateLimitInfo.limit);
            responseHeaders['X-RateLimit-Remaining'] = String(rateLimitInfo.remaining);
            responseHeaders['X-RateLimit-Reset'] = String(Math.ceil(rateLimitInfo.resetInMs / 1000));
          }

          return new Response(wrappedStream, {
            status: response.status,
            headers: responseHeaders,
          });
        } catch (fetchError) {
          clearTimeout(timeoutId);
          
          // Don't retry on abort/timeout errors
          if (fetchError instanceof Error && (
            fetchError.name === 'AbortError' ||
            fetchError.message.includes('aborted') ||
            fetchError.message.includes('timeout')
          )) {
            console.error('[API Proxy] Request aborted/timed out, not retrying:', fetchError);
            throw fetchError;
          }
          
          // Retry on network errors if we haven't exceeded max retries
          if (retryCount < maxRetries) {
            console.warn(`[API Proxy] Fetch error on attempt ${retryCount + 1}, will retry:`, fetchError);
            await sleep(calculateRetryDelay(retryCount, null, false));
            continue;
          }
          
          console.error('[API Proxy] Fetch error for streaming request after max retries:', fetchError);
          throw fetchError;
        }
      }
      
      // Should never reach here, but TypeScript needs it
      throw new Error('Unexpected error in streaming request handling');
    }

    // For non-streaming requests, use Braintrust tracing
    profiler.markStage(requestId, 'process_completion_start');
    const result = await processCompletion(body, apiKey, targetUrl.toString(), timeoutMs);
    profiler.markStage(requestId, 'process_completion_complete');

    // Handle non-streaming response
    if ('data' in result) {
      profiler.endRequest(requestId);
      console.log(`[API Proxy] Request ${requestId} complete. Total time: ${(performance.now() - requestStartTime).toFixed(2)}ms`);

      // Build response headers
      const responseHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Request-ID': requestId,
        'X-Response-Time': `${(performance.now() - requestStartTime).toFixed(2)}ms`,
      };

      // Add guest rate limit headers if applicable
      if (isGuestRequest) {
        const clientIP = getClientIP(request);
        const rateLimitInfo = checkGuestRateLimit(clientIP);
        responseHeaders['X-RateLimit-Limit'] = String(rateLimitInfo.limit);
        responseHeaders['X-RateLimit-Remaining'] = String(rateLimitInfo.remaining);
        responseHeaders['X-RateLimit-Reset'] = String(Math.ceil(rateLimitInfo.resetInMs / 1000));
      }

      return new Response(JSON.stringify(result.data), {
        status: result.status,
        headers: responseHeaders,
      });
    }

    // Handle streaming response from processCompletion
    if ('stream' in result) {
      // Build response headers
      const streamHeaders: Record<string, string> = {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      };

      // Add guest rate limit headers if applicable
      if (isGuestRequest) {
        const clientIP = getClientIP(request);
        const rateLimitInfo = checkGuestRateLimit(clientIP);
        streamHeaders['X-RateLimit-Limit'] = String(rateLimitInfo.limit);
        streamHeaders['X-RateLimit-Remaining'] = String(rateLimitInfo.remaining);
        streamHeaders['X-RateLimit-Reset'] = String(Math.ceil(rateLimitInfo.resetInMs / 1000));
      }

      return new Response(result.stream, {
        status: result.status,
        headers: streamHeaders,
      });
    }
  } catch (error) {
    profiler.markStage(requestId, 'error_occurred', {
      errorName: error instanceof Error ? error.name : 'UnknownError',
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    profiler.endRequest(requestId);
    console.error(`[API Proxy] Error [${requestId}]:`, error);

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
      details = `Request to backend API timed out after ${timeoutMs / 1000} seconds. The model may be overloaded, starting up, or experiencing issues. Try a different model or wait a moment and try again.`;
    } else if (errorDetails.message.includes('fetch') || errorDetails.message.includes('network') || errorDetails.name === 'TypeError') {
      status = 502;
      details = 'Could not connect to backend API. The service may be temporarily unavailable. Please check your internet connection.';
    } else if (errorDetails.message.includes('AbortError')) {
      status = 504;
      details = `Request was aborted after ${timeoutMs / 1000} seconds. This usually means the model is taking too long to respond. Try again with a simpler prompt or a faster model.`;
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
