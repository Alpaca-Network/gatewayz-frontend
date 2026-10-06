/**
 * React-query hook for GET /holdings/rewards (Bearer). See
 * src/lib/holdings/rewards-api.ts for the response shape.
 */
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { getHoldingsRewards, type HoldingsRewards } from '@/lib/holdings/rewards-api';

export const holdingsQueryKeys = {
  rewards: ['holdings', 'rewards'] as const,
};

export function useHoldingsRewards(options: { enabled?: boolean } = {}): UseQueryResult<HoldingsRewards> {
  return useQuery({
    queryKey: holdingsQueryKeys.rewards,
    queryFn: getHoldingsRewards,
    enabled: options.enabled ?? true,
    staleTime: 60_000,
    retry: false,
  });
}
