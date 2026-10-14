"use client";

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { getDelegationRewards, getDelegationStatus, type DelegationRewards, type DelegationStatus } from './api';
import { useDelegationFlagOn } from './flag-override';

export const delegationQueryKeys = {
  status: ['delegation', 'status'] as const,
  rewards: ['delegation', 'rewards'] as const,
  ethVault: ['delegation', 'eth-vault'] as const,
  cardanoAccount: ['delegation', 'cardano-account'] as const,
};

/** Public status. Never fetched while the build flag is off (outside an override). */
export function useDelegationStatus(): UseQueryResult<DelegationStatus> {
  const flagOn = useDelegationFlagOn();
  return useQuery({
    queryKey: delegationQueryKeys.status,
    queryFn: getDelegationStatus,
    enabled: flagOn,
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function useDelegationRewards(options: { enabled?: boolean } = {}): UseQueryResult<DelegationRewards> {
  const flagOn = useDelegationFlagOn();
  return useQuery({
    queryKey: delegationQueryKeys.rewards,
    queryFn: getDelegationRewards,
    enabled: (options.enabled ?? true) && flagOn,
    staleTime: 60_000,
    retry: false,
  });
}
