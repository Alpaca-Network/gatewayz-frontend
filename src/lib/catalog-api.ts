// API service for the public models/providers/gateways catalog

import { parseErrorResponse } from './errors';
import { isTauriDesktop } from './browser-detection';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.gatewayz.ai';

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
  const base = catalogFetchBase();
  const url = base ? `${base}/v1/gateways` : `/api/gateways`;

  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw await parseErrorResponse(response, 'Loading gateways');
  }
  const body = await response.json();
  if (base) {
    // Backend GET /v1/gateways returns { data: [...] } — the availability-probing
    // merge with the frontend registry only happens in the Next /api/gateways
    // proxy, so SSR/Tauri desktop get the backend's raw gateway list instead.
    return Array.isArray(body?.data) ? (body.data as CatalogGateway[]) : [];
  }
  return Array.isArray(body?.gateways) ? (body.gateways as CatalogGateway[]) : [];
}
