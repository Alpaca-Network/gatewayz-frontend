"use client";

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { getDiscountCredits, type DiscountCredits } from './api';
import { isVaultDiscountCreditsEnabled } from './flag';

const discountCreditsQueryKey = ['discount-credits'] as const;

/** The signed-in account's discount credits. Never fetched while the build flag is off. */
export function useDiscountCredits(options: { enabled?: boolean } = {}): UseQueryResult<DiscountCredits> {
  return useQuery({
    queryKey: discountCreditsQueryKey,
    queryFn: getDiscountCredits,
    enabled: (options.enabled ?? true) && isVaultDiscountCreditsEnabled(),
    staleTime: 60_000,
    retry: false,
  });
}
