/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { POST } from '../route';

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

jest.spyOn(console, 'log').mockImplementation();
jest.spyOn(console, 'error').mockImplementation();

function makeRequest(headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/tools/search/augment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ query: 'q' }),
  });
}

describe('POST /api/tools/search/augment', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, context: 'c', results_count: 1 }),
    });
  });

  it('forwards the Authorization header to the backend', async () => {
    await POST(makeRequest({ Authorization: 'Bearer abc', Cookie: 'secret=1' }));
    const init = mockFetch.mock.calls[0][1];
    expect(init.headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer abc',
    });
  });

  it('omits Authorization when the request has none', async () => {
    await POST(makeRequest());
    expect(mockFetch.mock.calls[0][1].headers).toEqual({ 'Content-Type': 'application/json' });
  });
});
