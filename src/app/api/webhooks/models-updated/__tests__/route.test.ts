/**
 * @jest-environment node
 */
import crypto from 'crypto';
import { NextRequest } from 'next/server';

jest.mock('next/cache', () => ({
  revalidateTag: jest.fn(),
  revalidatePath: jest.fn(),
}));

jest.mock('@sentry/nextjs', () => ({
  startSpan: jest.fn((_options, callback) => callback({ setAttribute: jest.fn() })),
  captureException: jest.fn(),
}));

import { POST } from '../route';

describe('POST /api/webhooks/models-updated', () => {
  const originalEnv = process.env;
  const secret = ['webhook', 'test', String(Date.now())].join('-');
  const body = JSON.stringify({ gateway: 'openrouter', event_type: 'models_updated', models: [] });

  const sign = (payload: string, key: string) =>
    crypto.createHmac('sha256', key).update(payload).digest('hex');

  const req = (signature?: string) =>
    new NextRequest('http://localhost:3000/api/webhooks/models-updated', {
      method: 'POST',
      headers: signature ? { 'x-webhook-signature': signature } : {},
      body,
    });

  beforeEach(() => {
    process.env = { ...originalEnv, MODEL_WEBHOOK_SECRET: secret };
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it('fails closed (503) when MODEL_WEBHOOK_SECRET is not set', async () => {
    delete process.env.MODEL_WEBHOOK_SECRET;
    // Signed with the old hardcoded fallback: must not be accepted
    const res = await POST(req(sign(body, 'your-webhook-secret')));
    expect(res.status).toBe(503);
  });

  it('rejects a missing signature', async () => {
    const res = await POST(req());
    expect(res.status).toBe(401);
  });

  it('rejects a wrong signature', async () => {
    const res = await POST(req(sign(body, 'not-the-secret')));
    expect(res.status).toBe(401);
  });

  it('rejects a truncated signature without throwing', async () => {
    const res = await POST(req(sign(body, secret).slice(0, 10)));
    expect(res.status).toBe(401);
  });

  it('accepts a valid signature', async () => {
    const res = await POST(req(sign(body, secret)));
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(503);
  });
});
