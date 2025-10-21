'use client';

import { useTier } from '@/hooks/use-tier';
import { AlertCircle, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import type { UserTier } from '@/lib/api';
import { TIER_CONFIG } from '@/lib/tier-utils';

interface TierAccessGuardProps {
  requiredTier: UserTier;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showButton?: boolean;
}

/**
 * Component that guards content based on user tier
 * Shows upgrade prompt if user doesn't have access
 */
export function TierAccessGuard({
  requiredTier,
  children,
  fallback,
  showButton = true,
}: TierAccessGuardProps) {
  const { tier, canAccessModel, tierInfo } = useTier();

  if (canAccessModel(requiredTier)) {
    return children;
  }

  const requiredTierConfig = TIER_CONFIG[requiredTier];
  const currentTierName = tierInfo.displayName;

  if (fallback) {
    return fallback;
  }

  return (
    <div className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-6">
      <div className="flex items-start gap-4">
        <div className="rounded-lg bg-amber-100 p-2">
          <Lock className="h-5 w-5 text-amber-600" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900">
            Upgrade Required
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            This feature is only available on the{' '}
            <span className="font-medium">{requiredTierConfig.name}</span> plan or higher.
            You're currently on the <span className="font-medium">{currentTierName}</span> plan.
          </p>
          {showButton && (
            <div className="mt-4">
              <Link href="/settings?tab=billing">
                <Button size="sm" variant="default">
                  Upgrade Now
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to check if current user can access a tier-restricted feature
 */
export function useCanAccessTier(requiredTier: UserTier): boolean {
  const { canAccessModel } = useTier();
  return canAccessModel(requiredTier);
}
