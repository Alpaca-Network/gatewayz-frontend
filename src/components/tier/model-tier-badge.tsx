'use client';

import { useTier } from '@/hooks/use-tier';
import { Badge } from '@/components/ui/badge';
import { Lock } from 'lucide-react';
import type { UserTier } from '@/lib/api';
import { TIER_CONFIG } from '@/lib/tier-utils';
import { cn } from '@/lib/utils';

interface ModelTierBadgeProps {
  requiredTier?: UserTier;
  showLocked?: boolean;
}

/**
 * Badge that shows if a model has tier restrictions
 * Displays lock icon if user doesn't have access
 */
export function ModelTierBadge({ requiredTier, showLocked = true }: ModelTierBadgeProps) {
  const { tier, canAccessModel } = useTier();

  if (!requiredTier) {
    return null; // No tier requirement
  }

  const hasAccess = canAccessModel(requiredTier);
  const tierConfig = TIER_CONFIG[requiredTier];

  if (!showLocked && !hasAccess) {
    return null;
  }

  const tierColors = {
    basic: 'bg-slate-100 text-slate-700 border-slate-200',
    pro: 'bg-blue-100 text-blue-700 border-blue-200',
    max: 'bg-purple-100 text-purple-700 border-purple-200',
  };

  return (
    <Badge
      variant="outline"
      className={cn(
        'flex items-center gap-1.5',
        tierColors[requiredTier],
        hasAccess && 'opacity-70'
      )}
    >
      {!hasAccess && <Lock className="h-3 w-3" />}
      {tierConfig.name} {hasAccess ? 'included' : 'only'}
    </Badge>
  );
}
