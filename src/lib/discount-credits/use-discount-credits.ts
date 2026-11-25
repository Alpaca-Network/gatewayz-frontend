"use client";

import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query';
import {
  getDiscountCredits,
  setDiscountCreditsDailyCap,
  type DiscountCredits,
  type DiscountCreditsDailyCapResult,
} from './api';
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

/** Changes the daily limit, then refetches the discount credits so the card shows the saved values. */
export function useSetDiscountCreditsDailyCap(): UseMutationResult<DiscountCreditsDailyCapResult, Error, string | number> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (capUsd: string | number) => setDiscountCreditsDailyCap(capUsd),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: discountCreditsQueryKey }),
  });
}
