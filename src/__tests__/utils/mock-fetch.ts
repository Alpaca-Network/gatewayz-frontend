/**
 * Shared mock utilities for fetch and Response objects
 *
 * These utilities ensure consistent mock patterns across all test files,
 * fixing issues with:
 * - Missing default fetch behavior causing silent test failures
 * - Inconsistent response mock structures
 * - Mocks not matching real API interfaces
 */

/**
 * Creates a properly typed mock Response that matches the real fetch Response interface
 */
export function createMockResponse<T>(
  data: T,
  options: {
    status?: number;
    ok?: boolean;
    statusText?: string;
    headers?: Record<string, string>;
  } = {}
): Response {
  const status = options.status ?? 200;
  const ok = options.ok ?? (status >= 200 && status < 300);
  const statusText = options.statusText ?? (ok ? 'OK' : 'Error');

  return {
    ok,
    status,
    statusText,
    headers: new Headers(options.headers),
    json: async () => data,
    text: async () => JSON.stringify(data),
    clone: () => createMockResponse(data, options),
    body: null,
    bodyUsed: false,
    arrayBuffer: async () => new ArrayBuffer(0),
    blob: async () => new Blob(),
    formData: async () => new FormData(),
    redirected: false,
    type: 'basic' as ResponseType,
    url: '',
  } as Response;
}

/**
 * Creates a mock Response for success cases
 */
export function createSuccessResponse<T>(data: T, status = 200): Response {
  return createMockResponse(data, { status, ok: true });
}

/**
 * Creates a mock Response for error cases
 */
export function createErrorResponse(
  error: { error?: string; detail?: string; message?: string },
  status: number
): Response {
  return createMockResponse(error, { status, ok: false });
}

/**
 * Sets up a global fetch mock with safe defaults
 *
 * When fetch is called without being mocked for a specific test,
 * it will throw a descriptive error instead of returning undefined
 */
export function setupFetchMock(): jest.Mock {
  const mockFetch = jest.fn();

  // Default implementation that fails loudly
  mockFetch.mockImplementation(() => {
    throw new Error(
      'Fetch was called but not mocked for this test. ' +
      'Use mockFetch.mockResolvedValue() or mockFetch.mockRejectedValue() to set up the mock.'
    );
  });

  global.fetch = mockFetch;
  return mockFetch;
}

/**
 * Resets the fetch mock to its default state
 */
export function resetFetchMock(mockFetch: jest.Mock): void {
  mockFetch.mockReset();
  mockFetch.mockImplementation(() => {
    throw new Error(
      'Fetch was called but not mocked for this test. ' +
      'Use mockFetch.mockResolvedValue() or mockFetch.mockRejectedValue() to set up the mock.'
    );
  });
}

/**
 * Helper to create a fetch mock that returns different responses based on URL
 */
export function createUrlBasedFetchMock(
  urlHandlers: Record<string, () => Promise<Response>>
): jest.Mock {
  const mockFetch = jest.fn();

  mockFetch.mockImplementation((url: string) => {
    for (const [pattern, handler] of Object.entries(urlHandlers)) {
      if (url.includes(pattern)) {
        return handler();
      }
    }
    // Default: return empty success
    return Promise.resolve(createSuccessResponse({ data: [] }));
  });

  return mockFetch;
}
