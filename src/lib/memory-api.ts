/**
 * Memory API - Client for managing user memories (cross-session AI context)
 *
 * This API allows users to:
 * - View memories extracted from their conversations
 * - Delete individual or all memories
 * - Get memory statistics
 */

import { API_BASE_URL } from './config';

// Memory categories
export type MemoryCategory =
  | 'preference'
  | 'context'
  | 'instruction'
  | 'fact'
  | 'name'
  | 'project'
  | 'general';

// Memory interface
export interface UserMemory {
  id: number;
  user_id: number;
  category: MemoryCategory;
  content: string;
  source_session_id: number | null;
  confidence: number;
  is_active: boolean;
  access_count: number;
  last_accessed_at: string | null;
  created_at: string;
  updated_at: string;
}

// API response interfaces
export interface MemoryListResponse {
  success: boolean;
  data: UserMemory[];
  count: number;
  message?: string;
}

export interface MemoryResponse {
  success: boolean;
  data: UserMemory | null;
  message?: string;
}

export interface MemoryStatsResponse {
  success: boolean;
  stats: {
    total_memories: number;
    by_category: Record<string, number>;
    oldest_memory: string | null;
    newest_memory: string | null;
  };
  message?: string;
}

export interface DeleteMemoriesResponse {
  success: boolean;
  deleted_count: number;
  message?: string;
}

export interface ExtractMemoriesResponse {
  success: boolean;
  extracted_count: number;
  memories: UserMemory[];
  message?: string;
}

export interface MemoryCategoriesResponse {
  categories: MemoryCategory[];
  descriptions: Record<MemoryCategory, string>;
}

// Category labels for UI display
export const MEMORY_CATEGORY_LABELS: Record<MemoryCategory, string> = {
  preference: 'Preference',
  context: 'Background',
  instruction: 'Instruction',
  fact: 'Fact',
  name: 'Personal',
  project: 'Project',
  general: 'General',
};

// Category colors for UI badges
export const MEMORY_CATEGORY_COLORS: Record<MemoryCategory, string> = {
  preference: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  context: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  instruction: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  fact: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  name: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
  project: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  general: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
};

/**
 * Memory API client class
 */
export class MemoryAPI {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl?: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl || `${API_BASE_URL}/v1/memory`;
  }

  /**
   * Makes an authenticated API request
   */
  private async makeRequest<T>(
    method: string,
    endpoint: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const config: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    };

    if (body) {
      config.body = JSON.stringify(body);
    }

    const response = await fetch(url, config);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Request failed with status ${response.status}`);
    }

    return response.json();
  }

  /**
   * Get all memories for the authenticated user
   */
  async getMemories(
    category?: MemoryCategory,
    limit: number = 50,
    offset: number = 0
  ): Promise<MemoryListResponse> {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    params.append('limit', limit.toString());
    params.append('offset', offset.toString());

    const queryString = params.toString();
    return this.makeRequest<MemoryListResponse>('GET', queryString ? `?${queryString}` : '');
  }

  /**
   * Get a specific memory by ID
   */
  async getMemory(memoryId: number): Promise<MemoryResponse> {
    return this.makeRequest<MemoryResponse>('GET', `/${memoryId}`);
  }

  /**
   * Delete a specific memory
   */
  async deleteMemory(memoryId: number, permanent: boolean = false): Promise<DeleteMemoriesResponse> {
    const params = permanent ? '?permanent=true' : '';
    return this.makeRequest<DeleteMemoriesResponse>('DELETE', `/${memoryId}${params}`);
  }

  /**
   * Delete all memories for the authenticated user
   */
  async deleteAllMemories(permanent: boolean = false): Promise<DeleteMemoriesResponse> {
    const params = permanent ? '?permanent=true' : '';
    return this.makeRequest<DeleteMemoriesResponse>('DELETE', params);
  }

  /**
   * Get memory statistics
   */
  async getStats(): Promise<MemoryStatsResponse> {
    return this.makeRequest<MemoryStatsResponse>('GET', '/stats');
  }

  /**
   * Manually trigger memory extraction from a chat session
   */
  async extractMemories(sessionId: number): Promise<ExtractMemoriesResponse> {
    return this.makeRequest<ExtractMemoriesResponse>('POST', '/extract', {
      session_id: sessionId,
    });
  }

  /**
   * Get available memory categories
   */
  async getCategories(): Promise<MemoryCategoriesResponse> {
    return this.makeRequest<MemoryCategoriesResponse>('GET', '/categories');
  }
}

/**
 * Create a MemoryAPI instance with the given API key
 */
export function createMemoryAPI(apiKey: string): MemoryAPI {
  return new MemoryAPI(apiKey);
}
