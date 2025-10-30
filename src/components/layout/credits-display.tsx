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

  useEffect(() => {
    const updateCredits = () => {
      const userData = getUserData();
      console.log('[CreditsDisplay] Loading credits from userData:', { userData, credits: userData?.credits, tier: userData?.tier });

      // Accept 0 as a valid credit value
      if (userData?.credits !== undefined && userData?.credits !== null) {
        const creditValue = Math.floor(userData.credits);
        console.log('[CreditsDisplay] Setting credits to:', creditValue);
        setCredits(creditValue);
        // Normalize tier to lowercase to handle case sensitivity
        const normalizedTier = userData.tier?.toLowerCase() as UserTier | undefined;
        console.log('[CreditsDisplay] Normalized tier:', { original: userData.tier, normalized: normalizedTier, isPro: normalizedTier === 'pro', isMax: normalizedTier === 'max' });
        setTier(normalizedTier);
      } else {
        console.log('[CreditsDisplay] No credits found in userData');
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
    console.log('[CreditsDisplay] Credits is null, not rendering');
    return null;
  }

  // Show plan name for PRO and MAX users
  const showPlanName = tier === 'pro' || tier === 'max';
  const planName = tier === 'pro' ? 'PRO' : tier === 'max' ? 'MAX' : '';

  console.log('[CreditsDisplay] Rendering:', { credits, tier, showPlanName, planName });

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
