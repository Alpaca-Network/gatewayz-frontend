/**
 * Tests for the error classifier extensions: classifyApiError, parseErrorResponse,
 * fromStreamingError. These cover the 5 distinct error-body shapes the backend
 * (gatewayz-backend) emits, documented in docs/api/errors.md.
 */
import {
  classifyApiError,
  classifySseError,
  parseErrorResponse,
  fromStreamingError,
  fromUnknown,
  getUserMessage,
  AppError,
} from '../index';
import { AuthenticationError, RateLimitError, StreamTimeoutError, EmptyResponseError } from '@/lib/streaming/errors';

function mockResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: new Headers(headers),
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

describe('classifyApiError', () => {
  it('maps a known backend error code to specific friendly copy (full envelope shape)', () => {
    const err = classifyApiError(402, {
      error: {
        type: 'insufficient_credits',
        code: 'INSUFFICIENT_CREDITS',
        status: 402,
        message: 'Insufficient credits. Required: $2.00, Current: $0.50',
      },
    });
    expect(getUserMessage(err)).toMatch(/credit/i);
    expect(getUserMessage(err)).not.toMatch(/\$2\.00/);
  });

  it('maps MODEL_NOT_FOUND to a specific message', () => {
    const err = classifyApiError(404, {
      error: { code: 'MODEL_NOT_FOUND', message: "Model 'gpt-5' not found" },
    });
    expect(getUserMessage(err)).toMatch(/model/i);
    expect(getUserMessage(err)).not.toMatch(/gpt-5/);
  });

  it('maps RATE_LIMIT_EXCEEDED and includes retry-after when present', () => {
    const err = classifyApiError(429, {
      error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Rate limit exceeded', context: { retry_after: 45 } },
    });
    expect(getUserMessage(err)).toMatch(/45/);
  });

  it('falls back to status-based classification for partial pass-through shape (no code)', () => {
    const err = classifyApiError(403, { error: { message: 'anonymous_daily_limit reached' } });
    expect(err).toBeInstanceOf(AppError);
    expect(getUserMessage(err)).not.toMatch(/anonymous_daily_limit/);
  });

  it('falls back to status-based classification for the string-error 429 variant', () => {
    const err = classifyApiError(429, {
      error: 'Rate limit exceeded',
      message: 'Too many requests',
      retry_after: 30,
    });
    expect(getUserMessage(err)).toMatch(/30|wait|moment/i);
    expect(getUserMessage(err)).not.toMatch(/^Rate limit exceeded$/);
  });

  it('falls back to status-based classification for the untouched FastAPI 422 default shape', () => {
    const err = classifyApiError(422, {
      detail: [{ type: 'missing', loc: ['body', 'messages'], msg: 'Field required', input: null }],
    });
    expect(getUserMessage(err)).toMatch(/invalid|check/i);
    expect(getUserMessage(err)).not.toMatch(/loc|Field required/);
  });

  it('classifies by status alone when the body is unparseable / empty', () => {
    const err500 = classifyApiError(500, undefined);
    expect(getUserMessage(err500)).toMatch(/server|wrong/i);

    const err401 = classifyApiError(401, null);
    expect(getUserMessage(err401)).toMatch(/session|log in/i);
  });

  it('never surfaces raw context/suggestions/detail text via getUserMessage', () => {
    const err = classifyApiError(500, {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'NullPointerException at line 42 in payment_processor.py',
        request_id: 'req_abc123',
      },
    });
    const msg = getUserMessage(err);
    expect(msg).not.toMatch(/NullPointerException|payment_processor|req_abc123/);
  });

  it('captures the request ID as metadata (for "Error ID" display) without putting it in the copy', () => {
    const err = classifyApiError(500, {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error (request ID: req_abc123)',
        request_id: 'req_abc123',
      },
    });
    expect(err.requestId).toBe('req_abc123');
    expect(getUserMessage(err)).not.toMatch(/req_abc123/);
  });

  it('reads the request ID from the X-Request-ID header option when the body has none', () => {
    const err = classifyApiError(500, {}, { requestId: 'req_header42' });
    expect(err.requestId).toBe('req_header42');
  });

  describe('status/code → user copy mapping table', () => {
    const cases: Array<{ name: string; status: number; body: unknown; opts?: Parameters<typeof classifyApiError>[2]; expected: RegExp; forbidden?: RegExp }> = [
      {
        name: '402 → not enough credits',
        status: 402,
        body: { detail: 'Insufficient credits. Required: $5.00' },
        expected: /enough credits/i,
        forbidden: /\$5\.00/,
      },
      {
        name: '403 subscription_canceled → subscription inactive',
        status: 403,
        body: { error: { code: 'subscription_canceled', message: 'canceled sub_999' } },
        expected: /subscription is inactive/i,
        forbidden: /sub_999/,
      },
      {
        name: '403 subscription_expired (via error.type) → subscription inactive',
        status: 403,
        body: { error: { type: 'subscription_expired', message: 'expired' } },
        expected: /subscription is inactive/i,
      },
      {
        name: '403 without subscription code → access copy, not subscription copy',
        status: 403,
        body: { error: { message: 'forbidden' } },
        expected: /credential|access|denied|invalid/i,
        forbidden: /subscription is inactive/i,
      },
      {
        name: 'gateway 429 with Retry-After → wait N seconds',
        status: 429,
        body: { detail: 'Rate limit exceeded' },
        opts: { retryAfter: 25 },
        expected: /wait 25 seconds/i,
        forbidden: /busy right now/i,
      },
      {
        name: 'gateway 429 without Retry-After → generic too-quickly copy',
        status: 429,
        body: {},
        expected: /too quickly/i,
      },
      {
        name: 'upstream 429 → model busy, NOT phrased as the user hitting their own limit',
        status: 429,
        body: { detail: 'Provider openai rate limited' },
        opts: { retryAfter: 10, rateLimitScope: 'upstream' },
        expected: /busy right now/i,
        forbidden: /too quickly|your.*limit|openai/i,
      },
      {
        name: '404 → not found copy',
        status: 404,
        body: {},
        expected: /not found/i,
      },
      {
        name: '422 → validation copy',
        status: 422,
        body: { detail: [{ type: 'missing', loc: ['body'], msg: 'Field required' }] },
        expected: /invalid|check/i,
        forbidden: /Field required/,
      },
      {
        name: '500 with no body → server copy',
        status: 500,
        body: undefined,
        expected: /server|wrong/i,
      },
      {
        name: '503 → server copy',
        status: 503,
        body: {},
        expected: /server|unavailable|wrong/i,
      },
      {
        name: 'unmapped status/code → generic something went wrong',
        status: 418,
        body: { error: { code: 'IM_A_TEAPOT', message: 'teapot detail' } },
        expected: /something went wrong/i,
        forbidden: /teapot/i,
      },
    ];

    it.each(cases)('$name', ({ status, body, opts, expected, forbidden }) => {
      const err = classifyApiError(status, body, opts);
      const msg = getUserMessage(err);
      expect(msg).toMatch(expected);
      if (forbidden) {
        expect(msg).not.toMatch(forbidden);
      }
    });
  });

  describe('upstream vs gateway 429 branching', () => {
    it('marks upstream 429s with scope + retry-after metadata and keeps them retryable', () => {
      const err = classifyApiError(429, {}, { rateLimitScope: 'upstream', retryAfter: 12 });
      expect(err.rateLimitScope).toBe('upstream');
      expect(err.retryAfterSeconds).toBe(12);
      expect(err.code).toBe('API_UPSTREAM_RATE_LIMITED');
      expect(err.retryable).toBe(true);
    });

    it('treats a 429 without the upstream scope header as a gateway limit', () => {
      const err = classifyApiError(429, {}, { retryAfter: 8 });
      expect(err.rateLimitScope).toBe('gateway');
      expect(err.code).toBe('API_RATE_LIMITED');
      expect(getUserMessage(err)).toMatch(/wait 8 seconds/i);
    });

    it('scope header comparison is case-insensitive', () => {
      const err = classifyApiError(429, {}, { rateLimitScope: 'Upstream' });
      expect(err.rateLimitScope).toBe('upstream');
    });

    it('keeps quota-specific copy for gateway DAILY_QUOTA_EXCEEDED', () => {
      const err = classifyApiError(429, { error: { code: 'DAILY_QUOTA_EXCEEDED', message: 'quota' } });
      expect(getUserMessage(err)).toMatch(/daily usage limit/i);
    });

    it('formats long Retry-After values as minutes/hours, not raw seconds', () => {
      const minutes = classifyApiError(429, {}, { retryAfter: 300 });
      expect(getUserMessage(minutes)).toMatch(/5 minutes/i);
      const hours = classifyApiError(429, {}, { retryAfter: 7200 });
      expect(getUserMessage(hours)).toMatch(/2 hours/i);
    });

    it('keeps sign-up copy for the guest daily limit (top-level code)', () => {
      const err = classifyApiError(429, {
        error: 'Daily limit reached',
        code: 'GUEST_RATE_LIMIT_EXCEEDED',
        message: "You've used all 10 free messages for today.",
      });
      expect(getUserMessage(err)).toMatch(/free messages for today.*sign up/is);
    });
  });

  describe('proxy envelope unwrapping', () => {
    it('classifies from the nested backend body wrapped by the Next.js proxy', () => {
      const err = classifyApiError(402, {
        error: 'Backend API Error',
        status: 402,
        message: 'raw passthrough detail',
        errorData: {
          error: { code: 'INSUFFICIENT_CREDITS', message: 'Insufficient credits. Required: $1.00' },
        },
      });
      expect(getUserMessage(err)).toMatch(/credits/i);
      expect(getUserMessage(err)).not.toMatch(/\$1\.00|raw passthrough/);
    });

    it('finds subscription codes inside the proxy envelope', () => {
      const err = classifyApiError(403, {
        error: 'Backend API Error',
        errorData: { error: { code: 'subscription_past_due', message: 'past due' } },
      });
      expect(getUserMessage(err)).toMatch(/subscription is inactive/i);
    });
  });
});

describe('classifySseError (SSE error_type → user copy)', () => {
  const sseCases: Array<{ errorType: string; expected: RegExp; retryable: boolean }> = [
    { errorType: 'rate_limit_error', expected: /busy right now/i, retryable: true },
    { errorType: 'capacity_error', expected: /at capacity/i, retryable: true },
    { errorType: 'provider_error', expected: /model had a problem responding.*not charged/i, retryable: true },
    { errorType: 'timeout_error', expected: /model had a problem responding.*not charged/i, retryable: true },
    { errorType: 'not_found_error', expected: /isn't available/i, retryable: false },
    { errorType: 'auth_error', expected: /credential|log(ging)? in|session/i, retryable: false },
    { errorType: 'stream_error', expected: /something went wrong/i, retryable: true },
  ];

  it.each(sseCases)('maps $errorType', ({ errorType, expected, retryable }) => {
    const err = classifySseError({ error_type: errorType, message: 'raw provider text with secrets' });
    expect(getUserMessage(err)).toMatch(expected);
    expect(getUserMessage(err)).not.toMatch(/raw provider text/);
    expect(err.retryable).toBe(retryable);
  });

  it('falls back to generic copy for unknown error types', () => {
    const err = classifySseError({ error_type: 'quantum_flux_error', message: 'exotic failure' });
    expect(getUserMessage(err)).toMatch(/something went wrong/i);
    expect(getUserMessage(err)).not.toMatch(/exotic failure/);
    expect(err.retryable).toBe(true);
  });

  it('carries the request ID through as metadata', () => {
    const err = classifySseError({ error_type: 'provider_error', request_id: 'req_sse1' });
    expect(err.requestId).toBe('req_sse1');
    expect(getUserMessage(err)).not.toMatch(/req_sse1/);
  });
});

describe('parseErrorResponse', () => {
  it('reads the JSON body and Retry-After header from a real Response', async () => {
    const response = mockResponse(
      429,
      { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'slow down' } },
      { 'Retry-After': '20' }
    );
    const err = await parseErrorResponse(response, 'fetching gateways');
    expect(getUserMessage(err)).toMatch(/20/);
  });

  it('reads X-RateLimit-Scope and X-Request-ID headers', async () => {
    const response = mockResponse(
      429,
      { detail: 'Provider rate limited' },
      { 'Retry-After': '15', 'X-RateLimit-Scope': 'upstream', 'X-Request-ID': 'req_hdr9' }
    );
    const err = await parseErrorResponse(response);
    expect(err.rateLimitScope).toBe('upstream');
    expect(err.retryAfterSeconds).toBe(15);
    expect(err.requestId).toBe('req_hdr9');
    expect(getUserMessage(err)).toMatch(/busy right now/i);
  });

  it('falls back gracefully when the body is not valid JSON', async () => {
    const response = {
      status: 503,
      ok: false,
      headers: new Headers(),
      json: async () => {
        throw new Error('not json');
      },
      text: async () => 'Service Unavailable',
    } as unknown as Response;
    const err = await parseErrorResponse(response);
    expect(getUserMessage(err)).toMatch(/server|unavailable|wrong/i);
  });
});

describe('fromStreamingError', () => {
  it('maps AuthenticationError to a friendly auth message', () => {
    const err = fromStreamingError(new AuthenticationError('Invalid API key for provider xyz'));
    expect(getUserMessage(err)).not.toMatch(/xyz/);
    expect(getUserMessage(err)).toMatch(/log(ging)? in|session|auth|credential/i);
  });

  it('maps RateLimitError and surfaces retry timing when present', () => {
    const err = fromStreamingError(new RateLimitError('rate limited upstream', 15000));
    expect(getUserMessage(err)).toMatch(/15|moment|wait/i);
  });

  it('maps StreamTimeoutError to a retryable network message', () => {
    const err = fromStreamingError(new StreamTimeoutError('stream timed out'));
    expect(getUserMessage(err)).toMatch(/time|try again/i);
  });

  it('maps EmptyResponseError to a model-unavailable message without leaking the model id', () => {
    const err = fromStreamingError(new EmptyResponseError('some-internal-model-slug-v3'));
    expect(getUserMessage(err)).not.toMatch(/some-internal-model-slug-v3/);
    expect(getUserMessage(err)).toMatch(/model/i);
  });
});

describe('getUserMessage safety net (regression guard)', () => {
  it('never echoes a raw generic Error message', () => {
    const err = new Error('column "foo" does not exist in relation "bar"');
    expect(getUserMessage(err)).not.toMatch(/column|relation/);
  });

  it('never echoes raw text through the fromUnknown(err) -> getUserMessage(...) composition', () => {
    // This is the exact trap: fromUnknown() used to fall back to `error.message`
    // for unrecognized errors, which getUserMessage() then returned verbatim
    // since it trusts AppError.message unconditionally.
    const raw = new Error('duplicate key value violates unique constraint "users_email_key"');
    const wrapped = fromUnknown(raw);
    expect(getUserMessage(wrapped)).not.toMatch(/duplicate key|constraint|users_email_key/);
  });

  it('does surface a caller-supplied context string via fromUnknown (safe, not raw)', () => {
    const raw = new Error('some internal detail');
    const wrapped = fromUnknown(raw, 'Failed to load your settings');
    expect(getUserMessage(wrapped)).toBe('Failed to load your settings');
  });
});
