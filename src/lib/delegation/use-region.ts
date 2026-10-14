"use client";

import { useEffect, useState } from 'react';
import { isDelegationRegionBlocked } from './region';

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
