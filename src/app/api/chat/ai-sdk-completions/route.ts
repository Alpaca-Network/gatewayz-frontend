import { NextRequest } from 'next/server';
import { normalizeModelId } from '@/lib/utils';
import { checkGuestRateLimit, incrementGuestRateLimit, getClientIP, formatResetTime } from '@/lib/guest-rate-limiter';

const DEBUG = process.env.NODE_ENV === 'development';
const debug = (...args: any[]) => DEBUG && console.log('[AI SDK Completions Proxy]', ...args);

/**
 * AI SDK Completions — plain fetch proxy to /v1/chat/completions.
 *
 * Previously used Vercel AI SDK streamText/createOpenAI which broke when
 * ai@v5 dropped the `compatibility` option and started calling /v1/responses
 * instead of /v1/chat/completions. All provider routing is handled by the backend.
 */
export async function POST(request: NextRequest) {
  let timeoutMs = 30000;

  try {
    const body = await request.json();

    // Guest rate limiting
    const clientIP = getClientIP(request);
    if (!body.apiKey || body.apiKey === 'guest') {
      const rateLimitResult = checkGuestRateLimit(clientIP);
      if (!rateLimitResult.allowed) {
        return new Response(
          JSON.stringify({
            error: 'Rate limit exceeded',
            message: `Guest rate limit reached. Resets ${formatResetTime(rateLimitResult.resetTime)}.`,
            remaining: rateLimitResult.remaining,
            resetTime: rateLimitResult.resetTime,
          }),
          { status: 429, headers: { 'Content-Type': 'application/json' } }
        );
      }
      // Attach IP for post-response increment
      (request as any).__guestClientIP = clientIP;
    }

    // Resolve API key
    const apiKey = body.apiKey && body.apiKey !== 'guest'
      ? body.apiKey
      : (request.headers.get('authorization')?.replace('Bearer ', '') || process.env.GUEST_API_KEY || '');

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'No API key provided' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Normalize model ID
    if (body.model) {
      body.model = normalizeModelId(body.model);
    }

    debug('Request:', body.model, body.stream ? 'streaming' : 'non-streaming');

    const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.gatewayz.ai';
    const targetUrl = new URL(`${apiUrl}/v1/chat/completions`);

    // Forward query params (e.g. session_id)
    new URL(request.url).searchParams.forEach((value, key) => {
      targetUrl.searchParams.set(key, value);
    });

    // Extended timeouts for large models
    const modelLower = (body.model || '').toLowerCase();
    const isLargeModel = modelLower.includes('30b') || modelLower.includes('70b') || modelLower.includes('405b');
    const isNearProvider = modelLower.startsWith('near/');
    const needsExtendedTimeout = isLargeModel || isNearProvider;

    if (body.stream) {
      timeoutMs = needsExtendedTimeout ? 300000 : 120000;
    } else {
      timeoutMs = needsExtendedTimeout ? 180000 : 30000;
    }

    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);

    // Strip internal-only fields before forwarding
    const { apiKey: _apiKey, ...forwardBody } = body;

    try {
      const response = await fetch(targetUrl.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          ...(body.stream ? { 'Accept': 'text/event-stream' } : {}),
        },
        body: JSON.stringify(forwardBody),
        signal: abortController.signal,
      });

      clearTimeout(timeoutId);

      debug('Response:', response.status);

      // Increment guest rate limit on success
      const guestClientIP = (request as any).__guestClientIP;
      if (guestClientIP && response.ok) {
        incrementGuestRateLimit(guestClientIP);
      }

      if (!response.ok) {
        const errorText = await response.text();
        let errorData: any;
        try { errorData = JSON.parse(errorText); } catch { errorData = { raw: errorText }; }
        return new Response(JSON.stringify({
          error: 'Backend API Error',
          status: response.status,
          message: errorData.message || errorData.detail || errorText.substring(0, 500),
          model: body.model,
        }), {
          status: response.status,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (body.stream) {
        if (!response.body) {
          return new Response(
            JSON.stringify({ error: 'No response body from backend' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response(response.body, {
          status: response.status,
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        });
      }

      // Non-streaming
      const data = await response.json();
      return new Response(JSON.stringify(data), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      });

    } catch (fetchError) {
      clearTimeout(timeoutId);
      throw fetchError;
    }

  } catch (error) {
    console.error('[AI SDK Completions Proxy] Error:', error);

    const isTimeout = error instanceof Error &&
      (error.name === 'TimeoutError' || error.message.includes('timeout') || error.message.includes('aborted'));
    const isNetwork = error instanceof Error &&
      (error.name === 'TypeError' || error.message.includes('fetch') || error.message.includes('network'));

    const status = isTimeout ? 504 : isNetwork ? 502 : 500;
    const message = isTimeout
      ? `Request timed out after ${Math.round(timeoutMs / 1000)}s.`
      : isNetwork
      ? 'Could not connect to backend API.'
      : (error instanceof Error ? error.message : 'Unknown error');

    return new Response(
      JSON.stringify({ error: message }),
      { status, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
