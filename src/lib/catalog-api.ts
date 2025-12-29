// API service for provider and models catalog management

import { makeAuthenticatedRequest } from './api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.gatewayz.ai';

// Provider Types
export type HealthStatus = 'healthy' | 'degraded' | 'down' | 'unknown';

export interface Provider {
  id: number;
  name: string;
  slug: string;
  description?: string;
  base_url?: string;
  api_key_env_var?: string;
  logo_url?: string;
  site_url?: string;
  privacy_policy_url?: string;
  terms_of_service_url?: string;
  status_page_url?: string;
  is_active: boolean;
  supports_streaming: boolean;
  supports_function_calling: boolean;
  supports_vision: boolean;
  supports_image_generation: boolean;
  health_status: HealthStatus;
  average_response_time_ms?: number;
  last_health_check_at?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ProviderStats {
  total_providers: number;
  active_providers: number;
  inactive_providers: number;
  health_distribution: {
    healthy: number;
    degraded: number;
    down: number;
    unknown: number;
  };
}

// Model Types
export interface Model {
  id: number;
  provider_id: number;
  model_id: string;
  model_name: string;
  provider_model_id: string;
  description?: string;
  context_length?: number;
  modality?: string;
  architecture?: string;
  top_provider?: string;
  per_request_limits?: Record<string, any>;
  pricing_prompt?: string;
  pricing_completion?: string;
  pricing_image?: string;
  pricing_request?: string;
  supports_streaming: boolean;
  supports_function_calling: boolean;
  supports_vision: boolean;
  is_active: boolean;
  health_status: HealthStatus;
  average_response_time_ms?: number;
  last_health_check_at?: string;
  success_rate?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ModelWithProvider extends Model {
  provider?: Provider;
}

export interface ModelStats {
  total_models: number;
  active_models: number;
  inactive_models: number;
  health_distribution: {
    healthy: number;
    degraded: number;
    down: number;
    unknown: number;
  };
  by_modality: Record<string, number>;
}

export interface ModelHealthHistory {
  id: number;
  model_id: number;
  health_status: HealthStatus;
  response_time_ms?: number;
  error_message?: string;
  checked_at: string;
}

// Provider API Functions
export class ProviderAPI {
  static async getAllProviders(params?: {
    is_active_only?: boolean;
    include_inactive?: boolean;
  }): Promise<Provider[]> {
    const queryParams = new URLSearchParams();
    if (params?.is_active_only) queryParams.append('is_active_only', 'true');
    if (params?.include_inactive) queryParams.append('include_inactive', 'true');

    const endpoint = `${API_BASE_URL}/providers${queryParams.toString() ? `?${queryParams}` : ''}`;
    const response = await makeAuthenticatedRequest(endpoint);

    if (!response.ok) {
      throw new Error(`Failed to fetch providers: ${response.statusText}`);
    }

    return response.json();
  }

  static async getProviderById(providerId: number): Promise<Provider> {
    const response = await makeAuthenticatedRequest(`${API_BASE_URL}/providers/${providerId}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch provider: ${response.statusText}`);
    }

    return response.json();
  }

  static async getProviderBySlug(slug: string): Promise<Provider> {
    const response = await makeAuthenticatedRequest(`${API_BASE_URL}/providers/slug/${slug}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch provider: ${response.statusText}`);
    }

    return response.json();
  }

  static async getProviderStats(): Promise<ProviderStats> {
    const response = await makeAuthenticatedRequest(`${API_BASE_URL}/providers/stats`);

    if (!response.ok) {
      throw new Error(`Failed to fetch provider stats: ${response.statusText}`);
    }

    return response.json();
  }

  static async searchProviders(query: string): Promise<Provider[]> {
    const response = await makeAuthenticatedRequest(
      `${API_BASE_URL}/providers/search?q=${encodeURIComponent(query)}`
    );

    if (!response.ok) {
      throw new Error(`Failed to search providers: ${response.statusText}`);
    }

    return response.json();
  }
}

// Models API Functions
export class ModelsAPI {
  static async getAllModels(params?: {
    provider_id?: number;
    provider_slug?: string;
    health_status?: HealthStatus;
    modality?: string;
    limit?: number;
    offset?: number;
    is_active_only?: boolean;
  }): Promise<ModelWithProvider[]> {
    const queryParams = new URLSearchParams();
    if (params?.provider_id) queryParams.append('provider_id', params.provider_id.toString());
    if (params?.provider_slug) queryParams.append('provider_slug', params.provider_slug);
    if (params?.health_status) queryParams.append('health_status', params.health_status);
    if (params?.modality) queryParams.append('modality', params.modality);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());
    if (params?.is_active_only) queryParams.append('is_active_only', 'true');

    const endpoint = `${API_BASE_URL}/models${queryParams.toString() ? `?${queryParams}` : ''}`;
    const response = await makeAuthenticatedRequest(endpoint);

    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.statusText}`);
    }

    return response.json();
  }

  static async getModelById(modelId: number): Promise<ModelWithProvider> {
    const response = await makeAuthenticatedRequest(`${API_BASE_URL}/models/${modelId}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch model: ${response.statusText}`);
    }

    return response.json();
  }

  static async getModelsByProvider(providerSlug: string, isActiveOnly: boolean = true): Promise<ModelWithProvider[]> {
    const endpoint = `${API_BASE_URL}/models/provider/${providerSlug}${isActiveOnly ? '?is_active_only=true' : ''}`;
    const response = await makeAuthenticatedRequest(endpoint);

    if (!response.ok) {
      throw new Error(`Failed to fetch models by provider: ${response.statusText}`);
    }

    return response.json();
  }

  static async getModelStats(providerId?: number): Promise<ModelStats> {
    const endpoint = providerId
      ? `${API_BASE_URL}/models/stats?provider_id=${providerId}`
      : `${API_BASE_URL}/models/stats`;
    const response = await makeAuthenticatedRequest(endpoint);

    if (!response.ok) {
      throw new Error(`Failed to fetch model stats: ${response.statusText}`);
    }

    return response.json();
  }

  static async searchModels(query: string, providerId?: number): Promise<ModelWithProvider[]> {
    const endpoint = providerId
      ? `${API_BASE_URL}/models/search?q=${encodeURIComponent(query)}&provider_id=${providerId}`
      : `${API_BASE_URL}/models/search?q=${encodeURIComponent(query)}`;

    const response = await makeAuthenticatedRequest(endpoint);

    if (!response.ok) {
      throw new Error(`Failed to search models: ${response.statusText}`);
    }

    return response.json();
  }

  static async getModelHealthHistory(modelId: number, limit: number = 100): Promise<ModelHealthHistory[]> {
    const response = await makeAuthenticatedRequest(
      `${API_BASE_URL}/models/${modelId}/health/history?limit=${limit}`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch model health history: ${response.statusText}`);
    }

    return response.json();
  }
}
