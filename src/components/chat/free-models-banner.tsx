"use client";

import { useEffect, useState } from 'react';
import { Sparkles, X } from "lucide-react";
import { getUserData } from '@/lib/api';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { getUserTier } from '@/lib/tier-utils';
import { useIsMobile } from '@/hooks/use-mobile';

const BANNER_DISMISSED_KEY = 'gatewayz_free_models_banner_dismissed';

export function FreeModelsBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [credits, setCredits] = useState<number>(0);
  const isMobile = useIsMobile();

  useEffect(() => {
    // Check if user has dismissed the banner recently (expires after 24 hours)
    const dismissedTimestamp = localStorage.getItem(BANNER_DISMISSED_KEY);
    if (dismissedTimestamp) {
      const dismissed = parseInt(dismissedTimestamp);
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
      if (dismissed > oneDayAgo) {
        return; // Still within 24 hours of dismissal
      }
    }

    const userData = getUserData();
    if (!userData) {
      return;
    }

    // Pro/Max users should never see this banner - they have active subscriptions
    const userTier = getUserTier(userData);
    if (userTier === 'pro' || userTier === 'max') {
      return;
    }

    // Show banner if user has $5 or fewer credits (low/expired trial)
    // Credits are stored in cents, so 500 cents = $5
    if (userData.credits <= 500) {
      setCredits(userData.credits / 100); // Convert cents to dollars for display
      setShowBanner(true);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(BANNER_DISMISSED_KEY, Date.now().toString());
    setShowBanner(false);
  };

  if (!showBanner) {
    return null;
  }

  // Mobile: Compact single-line banner
  if (isMobile) {
    return (
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-b border-green-200 dark:border-green-800">
        <div className="flex items-center justify-between px-3 py-1.5 gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Sparkles className="h-3.5 w-3.5 text-green-600 dark:text-green-400 flex-shrink-0" />
            <span className="text-xs text-green-800 dark:text-green-200 truncate">
              {credits === 0 ? "Credits used" : `$${credits.toFixed(2)} left`} · <span className="font-medium">FREE models available</span>
            </span>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Link href="/settings/credits">
              <Button
                size="sm"
                className="h-6 px-2 text-xs bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white"
              >
                Add
              </Button>
            </Link>
            <button
              onClick={handleDismiss}
              className="p-0.5 rounded text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900 transition-colors"
              aria-label="Dismiss banner"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Desktop: Full banner with details
  return (
    <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-b border-green-200 dark:border-green-800">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-green-900 dark:text-green-100">
                  {credits === 0 ? "Trial Credits Used Up" : `Low Credits ($${credits.toFixed(2)} remaining)`}
                </h3>
                <p className="text-sm text-green-800 dark:text-green-200 mt-1">
                  You can still use <strong className="font-semibold">FREE models</strong>! Look for the{' '}
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-green-600/10 dark:bg-green-400/10 text-green-700 dark:text-green-300 font-semibold"><Sparkles className="h-3 w-3" />FREE</span>
                  {' '}badge in the model selector. Add credits to unlock premium models.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Link href="/settings/credits">
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white"
                  >
                    Add Credits
                  </Button>
                </Link>
                <button
                  onClick={handleDismiss}
                  className="p-1 rounded-md text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900 transition-colors"
                  aria-label="Dismiss banner"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
