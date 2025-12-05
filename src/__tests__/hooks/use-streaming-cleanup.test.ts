/**
 * Tests for streaming cleanup and resource management
 * Ensures reader locks are properly released
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useStreaming } from '@/hooks/chat/use-streaming';

// Mock fetch and ReadableStream
global.fetch = jest.fn();

describe('useStreaming - Resource Cleanup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('should release reader lock when stream completes successfully', async () => {
    const releaseLockMock = jest.fn();
    const mockReader = {
      read: jest.fn()
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode('data: {"choices":[{"delta":{"content":"test"}}]}\n\n'),
        })
        .mockResolvedValueOnce({ done: true, value: undefined }),
      releaseLock: releaseLockMock,
    };

    const mockResponse = {
      ok: true,
      body: {
        getReader: jest.fn().mockReturnValue(mockReader),
      },
    };

    (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

    const onChunk = jest.fn();
    const { result } = renderHook(() => useStreaming());

    await act(async () => {
      await result.current.startStream(
        1,
        [{ role: 'user' as const, content: 'test' }],
        'test-model',
        onChunk
      );
    });

    // Run timers for stream completion
    await act(async () => {
      jest.advanceTimersByTime(100);
    });

    // Wait for stream to complete
    await waitFor(() => {
      expect(releaseLockMock).toHaveBeenCalled();
    });
  });

  it('should release reader lock when stream is aborted', async () => {
    const releaseLockMock = jest.fn();
    const mockReader = {
      read: jest.fn().mockImplementation(() => {
        // Simulate hanging read that will be aborted
        return new Promise(() => {});
      }),
      releaseLock: releaseLockMock,
    };

    const mockResponse = {
      ok: true,
      body: {
        getReader: jest.fn().mockReturnValue(mockReader),
      },
    };

    (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

    const onChunk = jest.fn();
    const { result } = renderHook(() => useStreaming());

    await act(async () => {
      result.current.startStream(
        1,
        [{ role: 'user' as const, content: 'test' }],
        'test-model',
        onChunk
      );
    });

    // Cancel the stream
    await act(async () => {
      result.current.cancelStream();
      jest.advanceTimersByTime(100);
    });

    // Verify reader lock was released
    await waitFor(() => {
      expect(releaseLockMock).toHaveBeenCalled();
    });
  });

  it('should release reader lock when stream errors', async () => {
    const releaseLockMock = jest.fn();
    const mockReader = {
      read: jest.fn().mockRejectedValue(new Error('Stream error')),
      releaseLock: releaseLockMock,
    };

    const mockResponse = {
      ok: true,
      body: {
        getReader: jest.fn().mockReturnValue(mockReader),
      },
    };

    (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

    const onChunk = jest.fn();
    const onError = jest.fn();
    const { result } = renderHook(() => useStreaming({ onError }));

    await act(async () => {
      await result.current.startStream(
        1,
        [{ role: 'user' as const, content: 'test' }],
        'test-model',
        onChunk
      );
    });

    // Wait for error handling
    await waitFor(() => {
      expect(onError).toHaveBeenCalled();
      expect(releaseLockMock).toHaveBeenCalled();
    });
  });

  it('should handle reader.releaseLock() throwing an error gracefully', async () => {
    const releaseLockMock = jest.fn().mockImplementation(() => {
      throw new Error('Lock already released');
    });

    const mockReader = {
      read: jest.fn()
        .mockResolvedValueOnce({ done: true, value: undefined }),
      releaseLock: releaseLockMock,
    };

    const mockResponse = {
      ok: true,
      body: {
        getReader: jest.fn().mockReturnValue(mockReader),
      },
    };

    (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

    const onChunk = jest.fn();
    const { result } = renderHook(() => useStreaming());

    // Should not throw even though releaseLock throws
    await act(async () => {
      await result.current.startStream(
        1,
        [{ role: 'user' as const, content: 'test' }],
        'test-model',
        onChunk
      );
    });

    await act(async () => {
      jest.advanceTimersByTime(100);
    });

    // Verify releaseLock was attempted despite throwing
    expect(releaseLockMock).toHaveBeenCalled();
  });

  it('should clean up timeout when stream completes', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

    const mockReader = {
      read: jest.fn()
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode('data: {"choices":[{"delta":{"content":"test"}}]}\n\n'),
        })
        .mockResolvedValueOnce({ done: true, value: undefined }),
      releaseLock: jest.fn(),
    };

    const mockResponse = {
      ok: true,
      body: {
        getReader: jest.fn().mockReturnValue(mockReader),
      },
    };

    (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

    const onChunk = jest.fn();
    const { result } = renderHook(() => useStreaming());

    await act(async () => {
      await result.current.startStream(
        1,
        [{ role: 'user' as const, content: 'test' }],
        'test-model',
        onChunk
      );
    });

    await act(async () => {
      jest.advanceTimersByTime(100);
    });

    // Verify timeout was cleared
    expect(clearTimeoutSpy).toHaveBeenCalled();

    clearTimeoutSpy.mockRestore();
  });
});
