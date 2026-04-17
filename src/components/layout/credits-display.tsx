"use client";

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { getUserData, saveUserData, getApiKey } from '@/lib/api';
import { formatCredits, formatCreditsDollar } from '@/lib/format-credits';
import type { UserTier } from '@/lib/api';
import { Coins, Crown, Sparkles, AlertCircle, Plus } from 'lucide-react';
import Link from 'next/link';
import { getTrialDaysRemaining, isOnTrial as checkIsOnTrial, isTrialExpired as checkIsTrialExpired, TIER_CONFIG, getUserTier } from '@/lib/tier-utils';

export function CreditsDisplay() {
  const [credits, setCredits] = useState<number | null>(null);
  const [tier, setTier] = useState<UserTier | undefined>(undefined);
  const [tierDisplayName, setTierDisplayName] = useState<string | undefined>(undefined);
  const [trialDaysRemaining, setTrialDaysRemaining] = useState<number | null>(null);
  const [isTrial, setIsTrial] = useState<boolean>(false);
  const [isTrialExpiredState, setIsTrialExpiredState] = useState<boolean>(false);
  const [subscriptionAllowance, setSubscriptionAllowance] = useState<number>(0);
  const [purchasedCredits, setPurchasedCredits] = useState<number>(0);

  useEffect(() => {
    const updateCredits = () => {
      const userData = getUserData();
      // Reduced logging - only log in development mode
      if (process.env.NODE_ENV === 'development') {
        console.log('[CreditsDisplay] Loading credits from userData:', { userData, credits: userData?.credits, tier: userData?.tier, subscription_status: userData?.subscription_status });
      }

      // Accept 0 as a valid credit value
      if (userData?.credits !== undefined && userData?.credits !== null) {
        const creditValue = userData.credits;
        if (process.env.NODE_ENV === 'development') {
          console.log('[CreditsDisplay] Setting credits to:', creditValue);
        }

        setCredits(creditValue);

        // Use getUserTier to properly determine tier from userData
        // This handles cases where tier field is missing but subscription_status is active
        const computedTier = getUserTier(userData);
        if (process.env.NODE_ENV === 'development') {
          console.log('[CreditsDisplay] Computed tier:', { original: userData.tier, computed: computedTier, subscription_status: userData.subscription_status, isPro: computedTier === 'pro', isMax: computedTier === 'max' });
        }

        // Only update tier if it has changed
        setTier(prevTier => {
          if (prevTier !== computedTier) {
            return computedTier;
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

        // Update trial status using utility functions that check tier first
        // This prevents showing trial/expired status for pro/max users with stale subscription_status
        setIsTrial(checkIsOnTrial(userData));
        setIsTrialExpiredState(checkIsTrialExpired(userData));

        // Update trial days remaining
        const daysRemaining = getTrialDaysRemaining(userData);
        setTrialDaysRemaining(daysRemaining);

        // Update tiered credit fields
        setSubscriptionAllowance(userData.subscription_allowance ?? 0);
        setPurchasedCredits(userData.purchased_credits ?? 0);
      } else {
        if (process.env.NODE_ENV === 'development') {
          console.log('[CreditsDisplay] No credits found in userData');
        }
      }
    };

    // Fetch fresh balance from backend and merge into localStorage
    const refreshFromBackend = async () => {
      const apiKey = getApiKey();
      if (!apiKey) return;
      try {
        const res = await fetch('/api/user/me?nocache=1', {
          headers: { 'Authorization': `Bearer ${apiKey}` },
          cache: 'no-store',
        });
        if (!res.ok) return;
        const data = await res.json();
        const stored = getUserData();
        if (!stored) return;
        saveUserData({
          ...stored,
          credits: data.credits ?? stored.credits,
          subscription_allowance: data.subscription_allowance ?? stored.subscription_allowance,
          purchased_credits: data.purchased_credits ?? stored.purchased_credits,
          total_credits: data.total_credits ?? stored.total_credits,
        });
        window.dispatchEvent(new Event('storage'));
      } catch {
        // silent — stale display is acceptable
      }
    };

    // Initial load from localStorage, then immediately fetch fresh from backend
    updateCredits();
    refreshFromBackend();

    // Listen for storage events (updates from other tabs or post-chat refresh)
    window.addEventListener('storage', updateCredits);

    // Refresh from backend every 30 seconds
    const interval = setInterval(refreshFromBackend, 30000);

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

  // Determine display mode based on tier (pro/max users show plan name)
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
  if (isTrialExpiredState) {
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

  // Pro/Max users - show credit usage progress bar with plan name
  if (showPlanName) {
    // monthlyAllowance is in dollars (1 credit = $1)
    const monthlyAllowanceDollars = tier ? TIER_CONFIG[tier].monthlyAllowance : 0;

    // Calculate percentage based on subscription_allowance remaining (both in dollars)
    const usagePercentage = monthlyAllowanceDollars > 0
      ? Math.min(100, Math.max(0, (subscriptionAllowance / monthlyAllowanceDollars) * 100))
      : 100;

    // 1 credit = $1.00 — display directly with $ prefix
    const subscriptionAllowanceCredits = subscriptionAllowance;
    const purchasedCreditsCount = purchasedCredits;

    const isLow = usagePercentage <= 20;
    const isMedium = usagePercentage > 20 && usagePercentage <= 50;

    return (
      <div className="flex items-center gap-2">
        <Link href="/settings/credits">
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2 sm:px-3 gap-1.5 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-950/50 text-amber-900 dark:text-amber-100"
          >
            <Crown className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs sm:text-sm">
                {planName}
              </span>
              {/* Allowance progress bar */}
              <div className="hidden sm:flex items-center gap-1.5">
                <div className="w-16 h-1.5 bg-amber-200 dark:bg-amber-900 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      isLow
                        ? 'bg-red-500'
                        : isMedium
                          ? 'bg-amber-500'
                          : 'bg-green-500'
                    }`}
                    style={{ width: `${usagePercentage}%` }}
                  />
                </div>
                <span className="text-[10px] text-amber-700 dark:text-amber-300 min-w-[32px]">
                  {formatCreditsDollar(subscriptionAllowanceCredits)}
                </span>
              </div>
              {/* Show purchased credits if any */}
              {purchasedCreditsCount > 0 && (
                <span className="hidden sm:inline text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                  +{formatCredits(purchasedCreditsCount)}
                </span>
              )}
            </div>
          </Button>
        </Link>
        {/* Add Credits button */}
        <Link href="/settings/credits?buy=true">
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2 gap-1 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-950/50 text-blue-900 dark:text-blue-100"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline text-xs font-medium">Add Credits</span>
          </Button>
        </Link>
      </div>
    );
  }

  const creditsDisplay = formatCredits(credits);
  return (
    <Link href="/settings/credits">
      <Button
        variant="outline"
        size="sm"
        className="h-8 px-2 sm:px-3 gap-1.5 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-950/50 text-amber-900 dark:text-amber-100"
      >
        <Coins className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
        <span className="font-semibold text-xs sm:text-sm">
          ${creditsDisplay}
        </span>
      </Button>
    </Link>
  );
}
