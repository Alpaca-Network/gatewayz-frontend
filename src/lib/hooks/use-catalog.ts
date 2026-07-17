/**
 * React-query hooks for the DB-driven catalog (Task 8).
 *
 * These are the single, canonical way for client components to read the model /
 * provider / gateway catalog. They wrap the typed getters in `@/lib/catalog-api`
 * (which read the backend's live catalog via the Next `/api/*` proxies) and apply
 * a shared 5-minute staleTime.
 *
 * Interface note: `useModels` / `useModel` / `useProviders` are consumed by Task 9's
 * chat model-select migration — keep their names and shapes stable.
 */
import { useQuery, keepPreviousData, type UseQueryResult } from '@tanstack/react-query';
import {
  getModels,
  getModel,
  getProviders,
  getGateways,
  type CatalogModel,
  type CatalogProvider,
  type CatalogGateway,
  type GetModelsFilters,
} from '@/lib/catalog-api';

const CATALOG_STALE_TIME = 5 * 60 * 1000; // 5 minutes

/** List public catalog models (optionally filtered by gateway/search/paging). */
export function useModels(
  filters: GetModelsFilters = {},
  options: { enabled?: boolean; keepPreviousData?: boolean } = {}
): UseQueryResult<CatalogModel[]> {
  return useQuery({
    queryKey: ['catalog', 'models', filters],
    queryFn: () => getModels(filters),
    staleTime: CATALOG_STALE_TIME,
    enabled: options.enabled ?? true,
    placeholderData: options.keepPreviousData ? keepPreviousData : undefined,
  });
}

/** Fetch a single catalog model by string id (e.g. "openai/gpt-4o"). */
export function useModel(id: string | null | undefined): UseQueryResult<CatalogModel | null> {
  return useQuery({
    queryKey: ['catalog', 'model', id],
    queryFn: () => getModel(id as string),
    staleTime: CATALOG_STALE_TIME,
    enabled: !!id,
  });
}

/** List public providers. */
export function useProviders(): UseQueryResult<CatalogProvider[]> {
  return useQuery({
    queryKey: ['catalog', 'providers'],
    queryFn: getProviders,
    staleTime: CATALOG_STALE_TIME,
  });
}

/** List gateways with display config (color/logo/priority/aliases). */
export function useGateways(): UseQueryResult<CatalogGateway[]> {
  return useQuery({
    queryKey: ['catalog', 'gateways'],
    queryFn: getGateways,
    staleTime: CATALOG_STALE_TIME,
  });
}
