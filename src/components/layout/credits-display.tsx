"use client";

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { getUserData } from '@/lib/api';
import { Coins } from 'lucide-react';
import Link from 'next/link';

export function CreditsDisplay() {
  const [credits, setCredits] = useState<number | null>(null);

  useEffect(() => {
    const updateCredits = () => {
      const userData = getUserData();
      if (userData?.credits !== undefined) {
        setCredits(Math.floor(userData.credits));
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

  if (credits === null) return null;

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
