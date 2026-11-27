/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';

jest.mock('next/cache', () => ({
  revalidateTag: jest.fn(),
  revalidatePath: jest.fn(),
}));

jest.mock('@sentry/nextjs', () => ({
  startSpan: jest.fn((_options, callback) => callback({ setAttribute: jest.fn() })),
  captureException: jest.fn(),
}));

jest.mock('@/lib/cache-strategies', () => {
  const actual = jest.requireActual('@/lib/cache-strategies');
  return {
    ...actual,
    cacheInvalidate: jest.fn().mockResolvedValue(3),
    cacheKeys: jest.fn().mockResolvedValue(['models:all']),
    getCacheMetrics: jest.fn().mockReturnValue({}),
    resetCacheMetrics: jest.fn(),
  };
});

jest.mock('@/lib/models-service', () => ({
  invalidateModelsCache: jest.fn().mockResolvedValue(0),
}));

import { POST, GET } from '../route';
import { cacheInvalidate, cacheKeys } from '@/lib/cache-strategies';

const mockCacheInvalidate = cacheInvalidate as jest.Mock;
const mockCacheKeys = cacheKeys as jest.Mock;

describe('/api/cache/invalidate', () => {
  const originalEnv = process.env;
  const secret = ['invalidate', 'test', String(Date.now())].join('-');

  const post = (body: unknown, auth?: string) =>
    new NextRequest('http://localhost:3000/api/cache/invalidate', {
      method: 'POST',
      headers: auth ? { authorization: auth } : {},
      body: JSON.stringify(body),
    });

  const get = (query: string, auth?: string) =>
    new NextRequest(`http://localhost:3000/api/cache/invalidate${query}`, {
      method: 'GET',
      headers: auth ? { authorization: auth } : {},
    });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, CACHE_WARMING_SECRET: secret };
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('POST', () => {
    it('returns 401 without authorization', async () => {
      const res = await POST(post({ pattern: 'models:*' }));
      expect(res.status).toBe(401);
      expect(mockCacheInvalidate).not.toHaveBeenCalled();
    });

    it('returns 401 with the wrong secret', async () => {
      const res = await POST(post({ pattern: 'models:*' }, 'Bearer wrong'));
      expect(res.status).toBe(401);
      expect(mockCacheInvalidate).not.toHaveBeenCalled();
    });

    it('fails closed (503) when CACHE_WARMING_SECRET is not set', async () => {
      delete process.env.CACHE_WARMING_SECRET;
      const res = await POST(post({ pattern: 'models:*' }, 'Bearer default-secret-change-me'));
      expect(res.status).toBe(503);
      expect(mockCacheInvalidate).not.toHaveBeenCalled();
    });

    it.each(['*', '**', '*:*', 'ratelimit:*', 'other:key', 'models', 'models:* extra', 123])(
      'rejects pattern %p with 400',
      async (pattern) => {
        const res = await POST(post({ pattern }, `Bearer ${secret}`));
        expect(res.status).toBe(400);
        expect(mockCacheInvalidate).not.toHaveBeenCalled();
      }
    );

    it('allows a pattern under a known cache prefix', async () => {
      const res = await POST(post({ pattern: 'rankings:*', type: 'search' }, `Bearer ${secret}`));
      expect(res.status).toBe(200);
      expect(mockCacheInvalidate).toHaveBeenCalledWith('rankings:*');
    });

    it('allows category invalidation when authorized', async () => {
      const res = await POST(post({ category: 'stats', type: 'search' }, `Bearer ${secret}`));
      expect(res.status).toBe(200);
      expect(mockCacheInvalidate).toHaveBeenCalledWith('stats:*');
    });
  });

  describe('GET', () => {
    it('returns 401 without authorization', async () => {
      const res = await GET(get(''));
      expect(res.status).toBe(401);
      expect(mockCacheKeys).not.toHaveBeenCalled();
    });

    it('fails closed (503) when CACHE_WARMING_SECRET is not set', async () => {
      delete process.env.CACHE_WARMING_SECRET;
      const res = await GET(get('', `Bearer ${secret}`));
      expect(res.status).toBe(503);
    });

    it('rejects the bare * pattern', async () => {
      const res = await GET(get('?pattern=*', `Bearer ${secret}`));
      expect(res.status).toBe(400);
      expect(mockCacheKeys).not.toHaveBeenCalled();
    });

    it('defaults to the models prefix when authorized', async () => {
      const res = await GET(get('', `Bearer ${secret}`));
      expect(res.status).toBe(200);
      expect(mockCacheKeys).toHaveBeenCalledWith('models:*');
    });
  });
});
