"use client";

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { getUserData } from '@/lib/api';
import type { UserTier } from '@/lib/api';
import { Coins, Crown } from 'lucide-react';
import Link from 'next/link';

export function CreditsDisplay() {
  const [credits, setCredits] = useState<number | null>(null);
  const [tier, setTier] = useState<UserTier | undefined>(undefined);
  const [tierDisplayName, setTierDisplayName] = useState<string | undefined>(undefined);

  useEffect(() => {
    const updateCredits = () => {
      const userData = getUserData();
      // Reduced logging - only log in development mode
      if (process.env.NODE_ENV === 'development') {
        console.log('[CreditsDisplay] Loading credits from userData:', { userData, credits: userData?.credits, tier: userData?.tier });
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

  // Show plan name for PRO and MAX users
  const showPlanName = tier === 'pro' || tier === 'max';
  // Use tier_display_name from backend, fallback to uppercase tier
  const planName = tierDisplayName || (tier === 'pro' ? 'PRO' : tier === 'max' ? 'MAX' : '');

  // Remove excessive render logging - this was causing console spam

  return (
    <Link href="/settings/credits">
      <Button
        variant="outline"
        size="sm"
        className="h-8 px-2 sm:px-3 gap-1.5 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-950/50 text-amber-900 dark:text-amber-100"
      >
        {showPlanName ? (
          <>
            <Crown className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
            <span className="font-semibold text-xs sm:text-sm">
              {planName}
            </span>
          </>
        ) : (
          <>
            <Coins className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
            <span className="font-semibold text-xs sm:text-sm">
              {credits.toLocaleString()}
            </span>
          </>
        )}
      </Button>
    </Link>
  );
}
