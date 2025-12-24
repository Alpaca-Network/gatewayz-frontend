/**
 * Tests for Memory API client
 *
 * Tests cover:
 * - Memory listing with pagination and filtering
 * - Memory retrieval by ID
 * - Memory deletion (soft and permanent)
 * - Memory statistics
 * - Memory extraction
 * - Category retrieval
 * - Error handling
 */

import {
  MemoryAPI,
  createMemoryAPI,
  MEMORY_CATEGORY_LABELS,
  MEMORY_CATEGORY_COLORS,
  type UserMemory,
  type MemoryCategory,
} from '../memory-api';

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('Memory API', () => {
  const testApiKey = 'test-api-key-123';
  let api: MemoryAPI;

  beforeEach(() => {
    jest.clearAllMocks();
    api = new MemoryAPI(testApiKey);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ============================================================
  // FIXTURES
  // ============================================================

  const mockMemory: UserMemory = {
    id: 1,
    user_id: 123,
    category: 'preference',
    content: 'User prefers Python over JavaScript',
    source_session_id: 100,
    confidence: 0.85,
    is_active: true,
    access_count: 3,
    last_accessed_at: '2024-01-15T10:00:00Z',
    created_at: '2024-01-10T08:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
  };

  const mockMemories: UserMemory[] = [
    mockMemory,
    {
      id: 2,
      user_id: 123,
      category: 'context',
      content: 'User is a backend engineer',
      source_session_id: 101,
      confidence: 0.90,
      is_active: true,
      access_count: 5,
      last_accessed_at: '2024-01-16T14:00:00Z',
      created_at: '2024-01-11T09:00:00Z',
      updated_at: '2024-01-16T14:00:00Z',
    },
  ];

  const mockStats = {
    total_memories: 15,
    by_category: {
      preference: 5,
      context: 3,
      fact: 4,
      name: 2,
      project: 1,
    },
    oldest_memory: '2024-01-01T00:00:00Z',
    newest_memory: '2024-01-17T12:00:00Z',
  };

  // ============================================================
  // createMemoryAPI
  // ============================================================

  describe('createMemoryAPI', () => {
    it('should create a MemoryAPI instance', () => {
      const instance = createMemoryAPI('my-api-key');
      expect(instance).toBeInstanceOf(MemoryAPI);
    });
  });

  // ============================================================
  // getMemories
  // ============================================================

  describe('getMemories', () => {
    it('should fetch memories with default parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: mockMemories,
          count: 2,
        }),
      });

      const result = await api.getMemories();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/memory?limit=50&offset=0'),
        expect.objectContaining({
          method: 'GET',
          headers: {
            Authorization: `Bearer ${testApiKey}`,
            'Content-Type': 'application/json',
          },
        })
      );
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.count).toBe(2);
    });

    it('should fetch memories with category filter', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [mockMemory],
          count: 1,
        }),
      });

      const result = await api.getMemories('preference', 50, 0);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('category=preference'),
        expect.any(Object)
      );
      expect(result.data).toHaveLength(1);
      expect(result.data[0].category).toBe('preference');
    });

    it('should fetch memories with pagination', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: mockMemories,
          count: 2,
        }),
      });

      await api.getMemories(undefined, 10, 20);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=10'),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('offset=20'),
        expect.any(Object)
      );
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ detail: 'Internal server error' }),
      });

      await expect(api.getMemories()).rejects.toThrow('Internal server error');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(api.getMemories()).rejects.toThrow('Network error');
    });
  });

  // ============================================================
  // getMemory
  // ============================================================

  describe('getMemory', () => {
    it('should fetch a single memory by ID', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: mockMemory,
        }),
      });

      const result = await api.getMemory(1);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/memory/1'),
        expect.objectContaining({
          method: 'GET',
        })
      );
      expect(result.success).toBe(true);
      expect(result.data?.id).toBe(1);
    });

    it('should handle 404 for non-existent memory', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ detail: 'Memory not found' }),
      });

      await expect(api.getMemory(999)).rejects.toThrow('Memory not found');
    });
  });

  // ============================================================
  // deleteMemory
  // ============================================================

  describe('deleteMemory', () => {
    it('should soft delete a memory', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          deleted_count: 1,
        }),
      });

      const result = await api.deleteMemory(1);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/memory/1'),
        expect.objectContaining({
          method: 'DELETE',
        })
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.not.stringContaining('permanent=true'),
        expect.any(Object)
      );
      expect(result.success).toBe(true);
      expect(result.deleted_count).toBe(1);
    });

    it('should permanently delete a memory', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          deleted_count: 1,
        }),
      });

      const result = await api.deleteMemory(1, true);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('permanent=true'),
        expect.any(Object)
      );
      expect(result.success).toBe(true);
    });

    it('should handle 404 for non-existent memory', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ detail: 'Memory not found' }),
      });

      await expect(api.deleteMemory(999)).rejects.toThrow('Memory not found');
    });
  });

  // ============================================================
  // deleteAllMemories
  // ============================================================

  describe('deleteAllMemories', () => {
    it('should soft delete all memories', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          deleted_count: 15,
        }),
      });

      const result = await api.deleteAllMemories();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/memory'),
        expect.objectContaining({
          method: 'DELETE',
        })
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.not.stringContaining('permanent=true'),
        expect.any(Object)
      );
      expect(result.deleted_count).toBe(15);
    });

    it('should permanently delete all memories', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          deleted_count: 15,
        }),
      });

      await api.deleteAllMemories(true);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('permanent=true'),
        expect.any(Object)
      );
    });

    it('should handle zero memories', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          deleted_count: 0,
        }),
      });

      const result = await api.deleteAllMemories();

      expect(result.deleted_count).toBe(0);
    });
  });

  // ============================================================
  // getStats
  // ============================================================

  describe('getStats', () => {
    it('should fetch memory statistics', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          stats: mockStats,
        }),
      });

      const result = await api.getStats();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/memory/stats'),
        expect.objectContaining({
          method: 'GET',
        })
      );
      expect(result.success).toBe(true);
      expect(result.stats.total_memories).toBe(15);
      expect(result.stats.by_category.preference).toBe(5);
    });

    it('should handle empty stats', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          stats: {
            total_memories: 0,
            by_category: {},
            oldest_memory: null,
            newest_memory: null,
          },
        }),
      });

      const result = await api.getStats();

      expect(result.stats.total_memories).toBe(0);
      expect(result.stats.oldest_memory).toBeNull();
    });
  });

  // ============================================================
  // extractMemories
  // ============================================================

  describe('extractMemories', () => {
    it('should trigger memory extraction', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          extracted_count: 3,
          memories: mockMemories,
        }),
      });

      const result = await api.extractMemories(100);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/memory/extract'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ session_id: 100 }),
        })
      );
      expect(result.success).toBe(true);
      expect(result.extracted_count).toBe(3);
    });

    it('should handle session not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ detail: 'Chat session not found' }),
      });

      await expect(api.extractMemories(999)).rejects.toThrow('Chat session not found');
    });

    it('should handle empty session', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          extracted_count: 0,
          memories: [],
          message: 'No messages in session to extract from',
        }),
      });

      const result = await api.extractMemories(100);

      expect(result.extracted_count).toBe(0);
      expect(result.memories).toHaveLength(0);
    });
  });

  // ============================================================
  // getCategories
  // ============================================================

  describe('getCategories', () => {
    it('should fetch available categories', async () => {
      const mockCategories = {
        categories: ['preference', 'context', 'fact', 'name', 'project', 'general'],
        descriptions: {
          preference: 'User preferences',
          context: 'Professional/personal context',
          fact: 'Factual information',
          name: 'Names mentioned',
          project: 'Project details',
          general: 'General information',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockCategories,
      });

      const result = await api.getCategories();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/memory/categories'),
        expect.objectContaining({
          method: 'GET',
        })
      );
      expect(result.categories).toContain('preference');
      expect(result.descriptions.preference).toBeDefined();
    });
  });

  // ============================================================
  // Error Handling
  // ============================================================

  describe('Error handling', () => {
    it('should handle 401 unauthorized', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ detail: 'Invalid API key' }),
      });

      await expect(api.getMemories()).rejects.toThrow('Invalid API key');
    });

    it('should handle 400 bad request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ detail: 'Invalid category' }),
      });

      await expect(api.getMemories('invalid' as MemoryCategory)).rejects.toThrow('Invalid category');
    });

    it('should handle response without JSON', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      await expect(api.getMemories()).rejects.toThrow('Request failed with status 500');
    });
  });

  // ============================================================
  // Category Constants
  // ============================================================

  describe('Category constants', () => {
    it('should have labels for all categories', () => {
      const categories: MemoryCategory[] = [
        'preference',
        'context',
        'instruction',
        'fact',
        'name',
        'project',
        'general',
      ];

      categories.forEach((category) => {
        expect(MEMORY_CATEGORY_LABELS[category]).toBeDefined();
        expect(typeof MEMORY_CATEGORY_LABELS[category]).toBe('string');
      });
    });

    it('should have colors for all categories', () => {
      const categories: MemoryCategory[] = [
        'preference',
        'context',
        'instruction',
        'fact',
        'name',
        'project',
        'general',
      ];

      categories.forEach((category) => {
        expect(MEMORY_CATEGORY_COLORS[category]).toBeDefined();
        expect(typeof MEMORY_CATEGORY_COLORS[category]).toBe('string');
        expect(MEMORY_CATEGORY_COLORS[category]).toContain('bg-');
      });
    });

    it('should have correct label values', () => {
      expect(MEMORY_CATEGORY_LABELS.preference).toBe('Preference');
      expect(MEMORY_CATEGORY_LABELS.context).toBe('Background');
      expect(MEMORY_CATEGORY_LABELS.instruction).toBe('Instruction');
      expect(MEMORY_CATEGORY_LABELS.fact).toBe('Fact');
      expect(MEMORY_CATEGORY_LABELS.name).toBe('Personal');
      expect(MEMORY_CATEGORY_LABELS.project).toBe('Project');
      expect(MEMORY_CATEGORY_LABELS.general).toBe('General');
    });
  });

  // ============================================================
  // Custom Base URL
  // ============================================================

  describe('Custom base URL', () => {
    it('should allow custom base URL', async () => {
      const customApi = new MemoryAPI(testApiKey, 'https://custom-api.example.com/v1/memory');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [],
          count: 0,
        }),
      });

      await customApi.getMemories();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('https://custom-api.example.com/v1/memory'),
        expect.any(Object)
      );
    });
  });
});
