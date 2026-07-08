/**
 * Tests for the error classifier extensions: classifyApiError, parseErrorResponse,
 * fromStreamingError. These cover the 5 distinct error-body shapes the backend
 * (gatewayz-backend) emits, documented in docs/api/errors.md.
 */
import {
  classifyApiError,
  parseErrorResponse,
  fromStreamingError,
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
});
