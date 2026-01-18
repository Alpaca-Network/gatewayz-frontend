/**
 * Tests for useWebVitals hooks
 *
 * These tests verify the performance optimizations including:
 * - Request deduplication via AbortController
 * - Debounced search functionality
 * - Proper cleanup on unmount
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import { useWebVitalsSummary, usePagePerformance } from '../use-web-vitals';

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock AbortController
const mockAbort = jest.fn();
class MockAbortController {
  signal = { aborted: false };
  abort = mockAbort;
}
global.AbortController = MockAbortController as unknown as typeof AbortController;

describe('useWebVitalsSummary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAbort.mockClear();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        performanceScore: { overall: 85, metrics: [], device: 'desktop', sampleCount: 100 },
        pageCount: 5,
        totalPageLoads: 1000,
        vitals: {},
        distribution: { good: 70, needsImprovement: 20, poor: 10 },
        timeRange: { start: '', end: '' },
      }),
    });
  });

  it('should fetch summary data on mount', async () => {
    const { result } = renderHook(() => useWebVitalsSummary());

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/vitals'),
      expect.objectContaining({ signal: expect.any(Object) })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.data).not.toBeNull();
    });
  });

  it('should include correct query params', async () => {
    renderHook(() => useWebVitalsSummary({ hours: 12, device: 'mobile' }));

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('hours=12'),
      expect.any(Object)
    );
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('device=mobile'),
      expect.any(Object)
    );
  });

  it('should include path param when provided', async () => {
    renderHook(() => useWebVitalsSummary({ path: '/signup' }));

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('path=%2Fsignup'),
      expect.any(Object)
    );
  });

  it('should not fetch when disabled', async () => {
    const { result } = renderHook(() => useWebVitalsSummary({ enabled: false }));

    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });

  it('should abort previous request when params change', async () => {
    const { rerender } = renderHook(
      ({ hours }) => useWebVitalsSummary({ hours }),
      { initialProps: { hours: 24 } }
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    // Change params to trigger new fetch
    rerender({ hours: 12 });

    await waitFor(() => {
      expect(mockAbort).toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  it('should abort request on unmount', async () => {
    const { unmount } = renderHook(() => useWebVitalsSummary());

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    unmount();

    expect(mockAbort).toHaveBeenCalled();
  });

  it('should handle fetch errors gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useWebVitalsSummary());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.error).not.toBeNull();
      expect(result.current.error?.message).toBe('Network error');
    });
  });

  it('should ignore abort errors', async () => {
    const abortError = new Error('Aborted');
    abortError.name = 'AbortError';
    mockFetch.mockRejectedValueOnce(abortError);

    const { result } = renderHook(() => useWebVitalsSummary());

    // AbortError should not set error state
    await waitFor(() => {
      expect(result.current.error).toBeNull();
    });
  });

  it('should refetch data when refetch is called', async () => {
    const { result } = renderHook(() => useWebVitalsSummary());

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  it('should set up polling when pollingInterval is provided', async () => {
    jest.useFakeTimers();

    renderHook(() => useWebVitalsSummary({ pollingInterval: 1000 }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    // Fast forward past polling interval
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    jest.useRealTimers();
  });

  it('should not poll when pollingInterval is 0', async () => {
    jest.useFakeTimers();

    renderHook(() => useWebVitalsSummary({ pollingInterval: 0 }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    act(() => {
      jest.advanceTimersByTime(60000);
    });

    // Should still only be 1 call (initial)
    expect(mockFetch).toHaveBeenCalledTimes(1);

    jest.useRealTimers();
  });
});

describe('usePagePerformance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAbort.mockClear();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        pages: [],
        totalPages: 0,
      }),
    });
  });

  it('should debounce search input', async () => {
    jest.useFakeTimers();

    const { rerender } = renderHook(
      ({ search }) => usePagePerformance({ search }),
      { initialProps: { search: '' } }
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    // Type rapidly
    rerender({ search: 'a' });
    rerender({ search: 'ab' });
    rerender({ search: 'abc' });

    // Should not have made additional fetches yet (debouncing)
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Fast forward past debounce delay (300ms)
    act(() => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      // Now it should fetch with debounced search term
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('search=abc'),
        expect.any(Object)
      );
    });

    jest.useRealTimers();
  });

  it('should include correct pagination params', async () => {
    renderHook(() => usePagePerformance({ limit: 10, offset: 20 }));

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('limit=10'),
      expect.any(Object)
    );
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('offset=20'),
      expect.any(Object)
    );
  });

  it('should include sort params', async () => {
    renderHook(() => usePagePerformance({ sortBy: 'performanceScore', sortOrder: 'asc' }));

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('sortBy=performanceScore'),
      expect.any(Object)
    );
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('sortOrder=asc'),
      expect.any(Object)
    );
  });

  it('should abort previous request when search changes', async () => {
    jest.useFakeTimers();

    const { rerender } = renderHook(
      ({ search }) => usePagePerformance({ search }),
      { initialProps: { search: '' } }
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    // Change search and wait for debounce
    rerender({ search: 'test' });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(mockAbort).toHaveBeenCalled();
    });

    jest.useRealTimers();
  });

  it('should not fetch when disabled', async () => {
    const { result } = renderHook(() => usePagePerformance({ enabled: false }));

    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });

  it('should handle non-200 responses', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      statusText: 'Internal Server Error',
    });

    const { result } = renderHook(() => usePagePerformance());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.error).not.toBeNull();
      expect(result.current.error?.message).toContain('Internal Server Error');
    });
  });

  it('should abort request on unmount', async () => {
    const { unmount } = renderHook(() => usePagePerformance());

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    unmount();

    expect(mockAbort).toHaveBeenCalled();
  });
});

describe('Performance optimizations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        performanceScore: { overall: 85, metrics: [], device: 'desktop', sampleCount: 100 },
        pageCount: 5,
        totalPageLoads: 1000,
        vitals: {},
        distribution: { good: 70, needsImprovement: 20, poor: 10 },
        timeRange: { start: '', end: '' },
      }),
    });
  });

  it('should use AbortController signal in fetch for request cancellation', async () => {
    renderHook(() => useWebVitalsSummary());

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          signal: expect.any(Object),
        })
      );
    });
  });

  it('should cancel in-flight request when new request starts', async () => {
    const { result } = renderHook(() => useWebVitalsSummary());

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    // Trigger refetch while first request is "in flight"
    mockFetch.mockImplementationOnce(() => new Promise(() => {})); // Never resolves

    act(() => {
      result.current.refetch();
    });

    expect(mockAbort).toHaveBeenCalled();
  });
});
