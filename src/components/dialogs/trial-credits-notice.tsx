"use client";

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, Sparkles } from "lucide-react";
import Link from 'next/link';
import { getUserData } from '@/lib/api';
import { safeLocalStorageGet, safeLocalStorageSet } from '@/lib/safe-storage';

const TRIAL_NOTICE_DISMISSED_KEY = 'gatewayz_trial_notice_dismissed';

export function TrialCreditsNotice() {
  const [showDialog, setShowDialog] = useState(false);
  const [credits, setCredits] = useState<number>(0);

  useEffect(() => {
    // Check if user has already dismissed this notice
    const dismissed = safeLocalStorageGet(TRIAL_NOTICE_DISMISSED_KEY);
    if (dismissed === 'true') {
      return;
    }

    // Delay showing the dialog to ensure user data is loaded
    const timer = setTimeout(() => {
      const userData = getUserData();
      if (!userData) {
        return;
      }

      // Show dialog if user has trial credits (3 or less) and hasn't added payment
      // This assumes users start with 3 credits and trial users haven't purchased more
      if (userData.credits > 0 && userData.credits <= 3) {
        setCredits(Math.floor(userData.credits));
        setShowDialog(true);
      }
    }, 2000); // Wait 2 seconds after page load for better UX

    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    safeLocalStorageSet(TRIAL_NOTICE_DISMISSED_KEY, 'true');
    setShowDialog(false);
  };

  const handleGetStarted = () => {
    handleDismiss();
    // Navigation will happen via the Link component
  };

  return (
    <Dialog open={showDialog} onOpenChange={setShowDialog}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-950 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <DialogTitle className="text-xl">Welcome to Gatewayz! 🎉</DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground">
            You're starting with <span className="font-semibold text-amber-600 dark:text-amber-400">{credits} free trial credits</span> to explore our platform.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-semibold text-amber-900 dark:text-amber-100">Important:</p>
              <p className="text-amber-800 dark:text-amber-200 mt-1">
                Trial credits expire <span className="font-semibold">3 days after signup</span> unless you add $3 or more to your account.
              </p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Ready to unlock unlimited access? Add credits to keep using all our powerful AI models without interruption.
          </p>
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleDismiss}
            className="w-full sm:w-auto"
          >
            Remind Me Later
          </Button>
          <Link href="/settings/credits" className="w-full sm:w-auto" onClick={handleGetStarted}>
            <Button
              type="button"
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700"
            >
              Add Credits & Get Started
            </Button>
          </Link>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
