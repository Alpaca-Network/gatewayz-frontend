/**
 * @jest-environment node
 *
 * Verifies the server-side (no `window`) URL construction used by real
 * server components / API routes — this is the path that was silently
 * dropping the `search` query param.
 *
 * Bug: GET /v1/models has no `search` param (src/routes/catalog.py
 * get_all_models/get_models) — the backend just ignores it and returns the
 * unfiltered catalog. The real search endpoint is GET /v1/models/search?q=
 * (catalog.py search_models). Fixed in src/lib/models-service.ts.
 */
import { getModelsForGateway } from '../models-service';

describe('models-service search (server-side)', () => {
  let mockFetch: jest.Mock;

  beforeEach(() => {
    mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('calls GET /v1/models/search?q=<query> (not /v1/models?search=) when a search term is provided', async () => {
    await getModelsForGateway('all', 20, 'gpt-4');

    expect(mockFetch).toHaveBeenCalled();
    const requestedUrls = mockFetch.mock.calls.map((call) => String(call[0]));

    expect(
      requestedUrls.some((url) => url.includes('/v1/models/search') && url.includes('q=gpt-4'))
    ).toBe(true);
    expect(
      requestedUrls.some((url) => /\/v1\/models\?/.test(url) && url.includes('search='))
    ).toBe(false);
  });

  it('still calls GET /v1/models (no search) when no search term is provided', async () => {
    await getModelsForGateway('openrouter', 20);

    const requestedUrls = mockFetch.mock.calls.map((call) => String(call[0]));
    expect(requestedUrls.some((url) => /\/v1\/models\?gateway=openrouter/.test(url))).toBe(true);
    expect(requestedUrls.some((url) => url.includes('/v1/models/search'))).toBe(false);
  });
});
