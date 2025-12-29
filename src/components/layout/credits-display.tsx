"use client";

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { getUserData } from '@/lib/api';
import type { UserTier, SubscriptionStatus } from '@/lib/api';
import { Coins, Crown, Sparkles, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { getTrialDaysRemaining } from '@/lib/tier-utils';

export function CreditsDisplay() {
  const [credits, setCredits] = useState<number | null>(null);
  const [tier, setTier] = useState<UserTier | undefined>(undefined);
  const [tierDisplayName, setTierDisplayName] = useState<string | undefined>(undefined);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | undefined>(undefined);
  const [trialDaysRemaining, setTrialDaysRemaining] = useState<number | null>(null);

  useEffect(() => {
    const updateCredits = () => {
      const userData = getUserData();
      // Reduced logging - only log in development mode
      if (process.env.NODE_ENV === 'development') {
        console.log('[CreditsDisplay] Loading credits from userData:', { userData, credits: userData?.credits, tier: userData?.tier, subscription_status: userData?.subscription_status });
      }

      // Accept 0 as a valid credit value
      if (userData?.credits !== undefined && userData?.credits !== null) {
        const creditValue = Math.floor(userData.credits);
        if (process.env.NODE_ENV === 'development') {
          console.log('[CreditsDisplay] Setting credits to:', creditValue);
        }

        // Only update state if the value has actually changed
        setCredits(prevCredits => {
          if (prevCredits !== creditValue) {
            return creditValue;
          }
          return prevCredits;
        });

        // Normalize tier to lowercase to handle case sensitivity
        const normalizedTier = userData.tier?.toLowerCase() as UserTier | undefined;
        if (process.env.NODE_ENV === 'development') {
          console.log('[CreditsDisplay] Normalized tier:', { original: userData.tier, normalized: normalizedTier, isPro: normalizedTier === 'pro', isMax: normalizedTier === 'max' });
        }

        // Only update tier if it has changed
        setTier(prevTier => {
          if (prevTier !== normalizedTier) {
            return normalizedTier;
          }
          return prevTier;
        });

        // Update tier display name
        setTierDisplayName(prevDisplayName => {
          if (prevDisplayName !== userData.tier_display_name) {
            return userData.tier_display_name;
          }
          return prevDisplayName;
        });

        // Update subscription status
        setSubscriptionStatus(prevStatus => {
          if (prevStatus !== userData.subscription_status) {
            return userData.subscription_status;
          }
          return prevStatus;
        });

        // Update trial days remaining
        const daysRemaining = getTrialDaysRemaining(userData);
        setTrialDaysRemaining(daysRemaining);
      } else {
        if (process.env.NODE_ENV === 'development') {
          console.log('[CreditsDisplay] No credits found in userData');
        }
      }
    };

    // Initial load
    updateCredits();

    // Listen for storage events (updates from other tabs)
    window.addEventListener('storage', updateCredits);

    // Poll for updates every 10 seconds
    const interval = setInterval(updateCredits, 10000);

    return () => {
      window.removeEventListener('storage', updateCredits);
      clearInterval(interval);
    };
  }, []);

  // Show 0 credits instead of hiding the component
  if (credits === null) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[CreditsDisplay] Credits is null, not rendering');
    }
    return null;
  }

  // Determine display mode based on subscription status and tier
  const isTrial = subscriptionStatus === 'trial';
  const isTrialExpired = subscriptionStatus === 'expired';
  const showPlanName = tier === 'pro' || tier === 'max';

  // Use tier_display_name from backend, fallback to uppercase tier
  const planName = tierDisplayName || (tier === 'pro' ? 'PRO' : tier === 'max' ? 'MAX' : '');

  // Trial users - show trial badge with days remaining
  if (isTrial) {
    const trialText = trialDaysRemaining !== null && trialDaysRemaining <= 1
      ? 'Trial ending'
      : `Trial${trialDaysRemaining !== null ? ` (${trialDaysRemaining}d)` : ''}`;

    return (
      <Link href="/settings/credits">
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-2 sm:px-3 gap-1.5 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 text-emerald-900 dark:text-emerald-100"
        >
          <Sparkles className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          <span className="font-semibold text-xs sm:text-sm">
            {trialText}
          </span>
        </Button>
      </Link>
    );
  }

  // Expired trial - show upgrade prompt
  if (isTrialExpired) {
    return (
      <Link href="/settings/credits">
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-2 sm:px-3 gap-1.5 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-950/50 text-red-900 dark:text-red-100"
        >
          <AlertCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
          <span className="font-semibold text-xs sm:text-sm">
            Upgrade
          </span>
        </Button>
      </Link>
    );
  }

  // Pro/Max users - show plan name with crown
  if (showPlanName) {
    return (
      <Link href="/settings/credits">
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-2 sm:px-3 gap-1.5 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-950/50 text-amber-900 dark:text-amber-100"
        >
          <Crown className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
          <span className="font-semibold text-xs sm:text-sm">
            {planName}
          </span>
        </Button>
      </Link>
    );
  }

  // Basic users - show credits
  return (
    <Link href="/settings/credits">
      <Button
        variant="outline"
        size="sm"
        className="h-8 px-2 sm:px-3 gap-1.5 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-950/50 text-amber-900 dark:text-amber-100"
      >
        <Coins className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
        <span className="font-semibold text-xs sm:text-sm">
          {credits.toLocaleString()}
        </span>
      </Button>
    </Link>
  );
}
