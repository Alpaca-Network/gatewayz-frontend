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
import { CheckCircle, Mail, Share2 } from "lucide-react";
import Link from 'next/link';
import { safeLocalStorageGet, safeLocalStorageSet } from '@/lib/safe-storage';

const REFERRAL_CONFIRMATION_SHOWN_KEY = 'gatewayz_referral_confirmation_shown';

/**
 * Optional confirmation dialog that shows the referrer a confirmation
 * that their referral was received and will appear on their dashboard.
 * This can be shown when the referrer navigates to /settings/referrals
 * and sees their new referral in the transaction list.
 */
export function ReferralConfirmationDialog({ newRefereeName }: { newRefereeName?: string }) {
  const [showDialog, setShowDialog] = useState(false);

  useEffect(() => {
    // Check if we should show the confirmation
    const shown = safeLocalStorageGet(REFERRAL_CONFIRMATION_SHOWN_KEY);
    if (shown === 'true') {
      return;
    }

    // Only show if there's a new referee name (passed as prop)
    if (!newRefereeName) {
      return;
    }

    // Delay to ensure UI is ready
    const timer = setTimeout(() => {
      setShowDialog(true);
    }, 1000);

    return () => clearTimeout(timer);
  }, [newRefereeName]);

  const handleClose = () => {
    safeLocalStorageSet(REFERRAL_CONFIRMATION_SHOWN_KEY, 'true');
    setShowDialog(false);
  };

  return (
    <Dialog open={showDialog} onOpenChange={setShowDialog}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <DialogTitle className="text-xl">Referral Confirmed! ✅</DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground">
            Your referral bonus has been successfully recorded
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          {/* Confirmation Card */}
          <div className="bg-green-50 dark:bg-green-950/30 p-4 rounded-lg border border-green-200 dark:border-green-800">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-green-900 dark:text-green-100">
                  {newRefereeName || 'New User'} has signed up!
                </p>
                <p className="text-sm text-green-800 dark:text-green-200 mt-1">
                  Their referral is now active on your dashboard and available in your referral list.
                </p>
              </div>
            </div>
          </div>

          {/* Email Notification Info */}
          <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-3">
              <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-blue-900 dark:text-blue-100">Email Confirmation Sent</p>
                <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
                  Check your email for details about your referral bonus and earnings.
                </p>
              </div>
            </div>
          </div>

          {/* Next Steps */}
          <div className="bg-muted/50 p-4 rounded-lg space-y-3">
            <h4 className="font-semibold text-sm">What's next?</h4>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li className="flex items-center gap-2">
                <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-semibold text-primary">1</span>
                </div>
                <span>Share your referral link to earn more bonuses</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-semibold text-primary">2</span>
                </div>
                <span>View all your referrals in your dashboard below</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-semibold text-primary">3</span>
                </div>
                <span>Earn credits for each successful referral</span>
              </li>
            </ul>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            className="w-full sm:w-auto"
          >
            Got It
          </Button>
          <Link href="/settings/referrals" className="w-full sm:w-auto" onClick={handleClose}>
            <Button
              type="button"
              className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 gap-2"
            >
              <Share2 className="h-4 w-4" />
              View All Referrals
            </Button>
          </Link>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
