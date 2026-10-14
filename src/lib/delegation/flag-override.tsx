"use client";

// Lets an unlisted surface (/stake, direct access only) run delegation while the
// build flag keeps every listed surface (/rewards, Settings -> Credits) dark.
// The backend locks still apply: status.enabled, the pool id, discount_enabled.
import { createContext, useContext, type ReactNode } from 'react';
import { isDelegationFlagOn } from './flags';

const DelegationFlagOverride = createContext(false);

export function DelegationFlagOverrideProvider({ children }: { children: ReactNode }) {
  return <DelegationFlagOverride.Provider value={true}>{children}</DelegationFlagOverride.Provider>;
}

/** The build flag, or true inside a DelegationFlagOverrideProvider. */
export function useDelegationFlagOn(): boolean {
  return useContext(DelegationFlagOverride) || isDelegationFlagOn();
}
