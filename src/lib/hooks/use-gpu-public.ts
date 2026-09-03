/**
 * React-query hooks for the public `/gpu` transparency dashboard (Milestone 4, W-D —
 * gatewayz-backend#2263 #2264). Wraps the typed client in `@/lib/gpu/public-api.ts`.
 * 30s refetch to match the backend's 30s server-side cache (spec.md §6).
 */
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import {
  getGpuPublicSummary,
  getGpuPublicNodes,
  getGpuUtilization,
  type GpuPublicSummary,
  type GpuPublicNode,
  type GpuUtilizationResponse,
  type GpuUtilizationWindow,
  type GpuUtilizationGroup,
} from '@/lib/gpu/public-api';

const REFETCH_INTERVAL_MS = 30_000;

/** GET /gpu/public/summary. */
export function useGpuPublicSummary(options: { enabled?: boolean } = {}): UseQueryResult<GpuPublicSummary> {
  return useQuery({
    queryKey: ['gpu-public-summary'],
    queryFn: getGpuPublicSummary,
    refetchInterval: REFETCH_INTERVAL_MS,
    enabled: options.enabled ?? true,
  });
}

/** GET /gpu/public/nodes. */
export function useGpuPublicNodes(options: { enabled?: boolean } = {}): UseQueryResult<GpuPublicNode[]> {
  return useQuery({
    queryKey: ['gpu-public-nodes'],
    queryFn: getGpuPublicNodes,
    refetchInterval: REFETCH_INTERVAL_MS,
    enabled: options.enabled ?? true,
  });
}

/** GET /gpu/public/utilization?window=&group=. */
export function useGpuUtilization(
  window: GpuUtilizationWindow,
  group: GpuUtilizationGroup
): UseQueryResult<GpuUtilizationResponse> {
  return useQuery({
    queryKey: ['gpu-public-utilization', window, group],
    queryFn: () => getGpuUtilization(window, group),
    refetchInterval: REFETCH_INTERVAL_MS,
  });
}
