// API service for provider and models catalog management

import { makeAuthenticatedRequest } from './api';
import { parseErrorResponse } from './errors';
import { isTauriDesktop } from './browser-detection';

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
      throw await parseErrorResponse(response, 'Loading providers');
    }

    return response.json();
  }

  static async getProviderById(providerId: number): Promise<Provider> {
    const response = await makeAuthenticatedRequest(`${API_BASE_URL}/providers/${providerId}`);

    if (!response.ok) {
      throw await parseErrorResponse(response, 'Loading provider');
    }

    return response.json();
  }

  static async getProviderBySlug(slug: string): Promise<Provider> {
    const response = await makeAuthenticatedRequest(`${API_BASE_URL}/providers/slug/${slug}`);

    if (!response.ok) {
      throw await parseErrorResponse(response, 'Loading provider');
    }

    return response.json();
  }

  static async getProviderStats(): Promise<ProviderStats> {
    const response = await makeAuthenticatedRequest(`${API_BASE_URL}/providers/stats`);

    if (!response.ok) {
      throw await parseErrorResponse(response, 'Loading provider stats');
    }

    return response.json();
  }

  static async searchProviders(query: string): Promise<Provider[]> {
    const response = await makeAuthenticatedRequest(
      `${API_BASE_URL}/providers/search?q=${encodeURIComponent(query)}`
    );

    if (!response.ok) {
      throw await parseErrorResponse(response, 'Searching providers');
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

    const endpoint = `${API_BASE_URL}/catalog/models-db${queryParams.toString() ? `?${queryParams}` : ''}`;
    const response = await makeAuthenticatedRequest(endpoint);

    if (!response.ok) {
      throw await parseErrorResponse(response, 'Loading models');
    }

    return response.json();
  }

  static async getModelById(modelId: number): Promise<ModelWithProvider> {
    const response = await makeAuthenticatedRequest(`${API_BASE_URL}/catalog/models-db/${modelId}`);

    if (!response.ok) {
      throw await parseErrorResponse(response, 'Loading model');
    }

    return response.json();
  }

  static async getModelsByProvider(providerSlug: string, isActiveOnly: boolean = true): Promise<ModelWithProvider[]> {
    const endpoint = `${API_BASE_URL}/catalog/models-db/provider/${providerSlug}${isActiveOnly ? '?is_active_only=true' : ''}`;
    const response = await makeAuthenticatedRequest(endpoint);

    if (!response.ok) {
      throw await parseErrorResponse(response, 'Loading models by provider');
    }

    return response.json();
  }

  static async getModelStats(providerId?: number): Promise<ModelStats> {
    const endpoint = providerId
      ? `${API_BASE_URL}/catalog/models-db/stats?provider_id=${providerId}`
      : `${API_BASE_URL}/catalog/models-db/stats`;
    const response = await makeAuthenticatedRequest(endpoint);

    if (!response.ok) {
      throw await parseErrorResponse(response, 'Loading model stats');
    }

    return response.json();
  }

  static async searchModels(query: string, providerId?: number): Promise<ModelWithProvider[]> {
    const endpoint = providerId
      ? `${API_BASE_URL}/catalog/models-db/search?q=${encodeURIComponent(query)}&provider_id=${providerId}`
      : `${API_BASE_URL}/catalog/models-db/search?q=${encodeURIComponent(query)}`;

    const response = await makeAuthenticatedRequest(endpoint);

    if (!response.ok) {
      throw await parseErrorResponse(response, 'Searching models');
    }

    return response.json();
  }

  static async getModelHealthHistory(modelId: number, limit: number = 100): Promise<ModelHealthHistory[]> {
    const response = await makeAuthenticatedRequest(
      `${API_BASE_URL}/catalog/models-db/${modelId}/health/history?limit=${limit}`
    );

    if (!response.ok) {
      throw await parseErrorResponse(response, 'Loading model health history');
    }

    return response.json();
  }
}

// ============================================================================
// Typed catalog getters (Task 8 — DB-driven catalog as the single source)
//
// The DB is the source of truth: these getters read the backend's live catalog
// via the Next `/api/*` proxy routes (CORS-safe from the browser — the react-query
// hooks in `src/lib/hooks/use-catalog.ts` run client-side, and Task 9's chat
// model-select consumes `useModels`). They intentionally target the PUBLIC catalog
// endpoints, not the admin-gated `/providers*` router:
//   - getModels  → /api/models       → backend GET /v1/models      ({ data: [...] })
//   - getModel   → /api/models/detail → backend GET /v1/models/... ({ data: {...} })
//   - getProviders → /api/providers  → backend GET /v1/provider    ({ data: [...] })  (public provider list)
//   - getGateways  → /api/gateways   → registry+backend merge      ({ gateways: [...] })
// ============================================================================

/** Public catalog model shape (OpenRouter-style, from GET /v1/models). */
export interface CatalogModel {
  id: string;
  name: string;
  description?: string;
  context_length?: number;
  architecture?: {
    modality?: string;
    input_modalities?: string[];
    output_modalities?: string[];
    instruct_type?: string;
  };
  pricing?: {
    prompt?: string;
    completion?: string;
    request?: string;
    image?: string;
  };
  supported_parameters?: string[];
  provider_slug?: string;
  provider_slugs?: string[];
  provider_site_url?: string;
  model_logo_url?: string;
  source_gateway?: string;
  source_gateways?: string[];
  is_private?: boolean;
  // Passthrough for any additional fields the backend adds.
  [key: string]: unknown;
}

/** Public provider shape (from GET /v1/provider). */
export interface CatalogProvider {
  slug: string;
  name?: string;
  site_url?: string;
  logo_url?: string;
  model_count?: number;
  source_gateway?: string;
  [key: string]: unknown;
}

/** Gateway display config (from GET /api/gateways — registry merged with backend). */
export interface CatalogGateway {
  id: string;
  name: string;
  color?: string;
  priority?: 'fast' | 'slow';
  site_url?: string;
  logo_url?: string;
  icon?: string;
  aliases?: string[];
  deprecated?: boolean;
  requiresApiKey?: boolean;
  available?: boolean;
}

export interface GetModelsFilters {
  /** Gateway id or 'all' (default 'all'). */
  gateway?: string;
  /** Full-text search query (routes to backend /v1/models/search). */
  search?: string;
  limit?: number;
  offset?: number;
}

// Client uses the relative Next proxy (avoids CORS); server-side AND Tauri
// desktop (static export has no Next API routes at runtime, even though
// `window` is defined in its webview) fall back to the direct backend URL so
// these getters remain usable from server components and the desktop app.
function catalogFetchBase(): string {
  if (typeof window === 'undefined') return API_BASE_URL;
  if (isTauriDesktop()) return API_BASE_URL;
  return '';
}

/**
 * List public catalog models. Reads the DB-backed catalog via /api/models
 * (backend GET /v1/models), unwrapping the `{ data: [...] }` envelope.
 */
export async function getModels(filters: GetModelsFilters = {}): Promise<CatalogModel[]> {
  const gateway = filters.gateway ?? 'all';
  const base = catalogFetchBase();

  // GET /v1/models has no `search` query param — the backend silently ignores
  // it (src/routes/catalog.py get_all_models). Real full-text search lives at
  // GET /v1/models/search?q=<query> (catalog.py search_models). The Next proxy
  // (/api/models) already does this routing server-side (see
  // models-service.ts fetchModelsFromGateway); when talking to the backend
  // directly (Tauri desktop static export, or SSR) we must route there ourselves.
  if (filters.search && base) {
    const params = new URLSearchParams();
    params.set('q', filters.search);
    params.set('gateway', gateway);
    if (filters.limit != null) params.set('limit', String(filters.limit));

    const response = await fetch(`${base}/v1/models/search?${params.toString()}`, { cache: 'no-store' });
    if (!response.ok) {
      throw await parseErrorResponse(response, 'Searching models');
    }
    const body = await response.json();
    return Array.isArray(body?.data) ? (body.data as CatalogModel[]) : [];
  }

  const params = new URLSearchParams();
  params.set('gateway', gateway);
  if (filters.limit != null) params.set('limit', String(filters.limit));
  if (filters.offset != null) params.set('offset', String(filters.offset));
  if (filters.search) params.set('search', filters.search);

  const url = base
    ? `${base}/v1/models?${params.toString()}`
    : `/api/models?${params.toString()}`;

  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw await parseErrorResponse(response, 'Loading models');
  }
  const body = await response.json();
  return Array.isArray(body?.data) ? (body.data as CatalogModel[]) : [];
}

/**
 * Fetch a single public catalog model by its string id (e.g. "openai/gpt-4o").
 * Returns null for an empty id or when the model is not found.
 */
export async function getModel(id: string): Promise<CatalogModel | null> {
  if (!id) return null;

  const base = catalogFetchBase();
  const query = `modelId=${encodeURIComponent(id)}`;
  const url = base
    ? `${base}/v1/models/search?q=${encodeURIComponent(id)}`
    : `/api/models/detail?${query}`;

  const response = await fetch(url, { cache: 'no-store' });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw await parseErrorResponse(response, 'Loading model');
  }
  const body = await response.json();
  if (base) {
    // Backend /v1/models/search returns { data: [...] }; take the first match.
    const first = Array.isArray(body?.data) ? body.data[0] : undefined;
    return (first as CatalogModel) ?? null;
  }
  // /api/models/detail returns { data: {...} }.
  return (body?.data as CatalogModel) ?? null;
}

/**
 * List public providers. Reads /api/providers (backend GET /v1/provider), the
 * PUBLIC provider catalog — the `/providers*` admin router is intentionally not used.
 */
export async function getProviders(): Promise<CatalogProvider[]> {
  const base = catalogFetchBase();
  const url = base ? `${base}/v1/provider` : `/api/providers`;

  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw await parseErrorResponse(response, 'Loading providers');
  }
  const body = await response.json();
  return Array.isArray(body?.data) ? (body.data as CatalogProvider[]) : [];
}

/**
 * List gateways with their display config (color/logo/priority/aliases).
 * Reads /api/gateways, which merges the frontend registry with backend availability.
 */
export async function getGateways(): Promise<CatalogGateway[]> {
  const response = await fetch(`/api/gateways`, { cache: 'no-store' });
  if (!response.ok) {
    throw await parseErrorResponse(response, 'Loading gateways');
  }
  const body = await response.json();
  return Array.isArray(body?.gateways) ? (body.gateways as CatalogGateway[]) : [];
}
