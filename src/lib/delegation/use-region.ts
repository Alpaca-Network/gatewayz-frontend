"use client";

import { useEffect, useState } from 'react';
import type { DelegationEligibility } from './api';
import { isDelegationRegionBlocked } from './region';
import { useDelegationRewards } from './use-delegation';

/**
 * Whether the visitor's country is restricted. `undefined` until mounted (the
 * cookie is only readable in the browser), so callers render nothing rather
 * than flash the section at a restricted visitor.
 */
export function useDelegationRegionBlocked(): boolean | undefined {
  const [blocked, setBlocked] = useState<boolean | undefined>(undefined);
  useEffect(() => {
    setBlocked(isDelegationRegionBlocked());
  }, []);
  return blocked;
}

/**
 * The backend's verdict on the signed-in account (GET /delegation/rewards →
 * eligibility). Reads whatever the rewards query already holds and never
 * fetches on its own, so it is null while signed out, before the rewards load,
 * and from a backend that predates the attestation.
 */
export function useServerEligibility(): DelegationEligibility | null {
  return useDelegationRewards({ enabled: false }).data?.eligibility ?? null;
}

/**
 * Restricted when the edge places the visitor in the US or Canada, or the
 * backend has marked the account restricted. `undefined` until mounted.
 */
export function useDelegationRestricted(): boolean | undefined {
  const regionBlocked = useDelegationRegionBlocked();
  const server = useServerEligibility();
  if (server?.status === 'restricted') return true;
  return regionBlocked;
}
