/**
 * Tests for use-tool-definitions hook
 *
 * Tests the hook that fetches and manages tool definitions from the backend API.
 */

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  useToolDefinitions,
  filterEnabledTools,
  ToolDefinition,
} from '@/lib/hooks/use-tool-definitions';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('useToolDefinitions', () => {
  let queryClient: QueryClient;

  const mockToolDefinitions: ToolDefinition[] = [
    {
      type: 'function',
      function: {
        name: 'web_search',
        description: 'Search the web for information',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
          },
          required: ['query'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'text_to_speech',
        description: 'Convert text to speech',
        parameters: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'Text to convert' },
          },
          required: ['text'],
        },
      },
    },
  ];

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    mockFetch.mockReset();
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe('hook behavior', () => {
    it('should fetch tool definitions successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockToolDefinitions),
      });

      const { result } = renderHook(() => useToolDefinitions(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockToolDefinitions);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/tools/definitions')
      );
    });

    it('should handle fetch error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const { result } = renderHook(() => useToolDefinitions(), { wrapper });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });

    it('should handle network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useToolDefinitions(), { wrapper });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeInstanceOf(Error);
    });

    it('should be in loading state initially', () => {
      mockFetch.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 1000))
      );

      const { result } = renderHook(() => useToolDefinitions(), { wrapper });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();
    });
  });
});

describe('filterEnabledTools', () => {
  const mockToolDefinitions: ToolDefinition[] = [
    {
      type: 'function',
      function: {
        name: 'web_search',
        description: 'Search the web',
        parameters: { type: 'object', properties: {} },
      },
    },
    {
      type: 'function',
      function: {
        name: 'text_to_speech',
        description: 'Convert text to speech',
        parameters: { type: 'object', properties: {} },
      },
    },
    {
      type: 'function',
      function: {
        name: 'code_interpreter',
        description: 'Execute code',
        parameters: { type: 'object', properties: {} },
      },
    },
  ];

  it('should filter tools by enabled tool names', () => {
    const enabledTools = ['web_search', 'code_interpreter'];
    const result = filterEnabledTools(mockToolDefinitions, enabledTools);

    expect(result).toHaveLength(2);
    expect(result.map((t) => t.function.name)).toEqual([
      'web_search',
      'code_interpreter',
    ]);
  });

  it('should return empty array when no tools are enabled', () => {
    const result = filterEnabledTools(mockToolDefinitions, []);

    expect(result).toEqual([]);
  });

  it('should return empty array when definitions is undefined', () => {
    const result = filterEnabledTools(undefined, ['web_search']);

    expect(result).toEqual([]);
  });

  it('should handle enabled tools that do not exist in definitions', () => {
    const enabledTools = ['web_search', 'nonexistent_tool'];
    const result = filterEnabledTools(mockToolDefinitions, enabledTools);

    expect(result).toHaveLength(1);
    expect(result[0].function.name).toBe('web_search');
  });

  it('should preserve order based on definitions', () => {
    const enabledTools = ['code_interpreter', 'web_search'];
    const result = filterEnabledTools(mockToolDefinitions, enabledTools);

    // Order should match definitions order, not enabled tools order
    expect(result[0].function.name).toBe('web_search');
    expect(result[1].function.name).toBe('code_interpreter');
  });

  it('should return single tool when only one is enabled', () => {
    const result = filterEnabledTools(mockToolDefinitions, ['text_to_speech']);

    expect(result).toHaveLength(1);
    expect(result[0].function.name).toBe('text_to_speech');
  });

  it('should return all tools when all are enabled', () => {
    const enabledTools = ['web_search', 'text_to_speech', 'code_interpreter'];
    const result = filterEnabledTools(mockToolDefinitions, enabledTools);

    expect(result).toHaveLength(3);
  });
});
