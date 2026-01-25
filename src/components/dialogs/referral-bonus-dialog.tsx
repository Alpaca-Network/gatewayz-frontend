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
import { Gift, Share2, ArrowRight } from "lucide-react";
import Link from 'next/link';
import { getUserData } from '@/lib/api';

const REFERRAL_BONUS_DISMISSED_KEY = 'gatewayz_referral_bonus_dismissed';

export function ReferralBonusDialog() {
  const [showDialog, setShowDialog] = useState(false);
  const [bonusAmount, setBonusAmount] = useState<number>(0);
  const [totalCredits, setTotalCredits] = useState<number>(0);

  useEffect(() => {
    // Check if user has already dismissed this notice
    const dismissed = localStorage.getItem(REFERRAL_BONUS_DISMISSED_KEY);
    if (dismissed === 'true') {
      return;
    }

    // Check for referral bonus flag
    const showReferralBonus = localStorage.getItem('gatewayz_show_referral_bonus');
    if (showReferralBonus !== 'true') {
      return;
    }

    // Delay showing the dialog to ensure user data is loaded
    const timer = setTimeout(() => {
      const userData = getUserData();
      if (!userData) {
        return;
      }

      // Calculate bonus: total credits - 500 cents ($5 base trial credits)
      // Credits are stored in cents
      const baseCredits = 500; // $5 in cents
      const totalCents = Math.floor(userData.credits);
      const bonusCents = Math.max(0, totalCents - baseCredits);

      if (bonusCents > 0) {
        // Convert to dollars for display
        setBonusAmount(bonusCents / 100);
        setTotalCredits(totalCents / 100);
        setShowDialog(true);
      } else {
        // No bonus found, just dismiss
        localStorage.setItem(REFERRAL_BONUS_DISMISSED_KEY, 'true');
      }
    }, 1500); // Wait 1.5 seconds after page load for better UX

    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(REFERRAL_BONUS_DISMISSED_KEY, 'true');
    localStorage.removeItem('gatewayz_show_referral_bonus');
    setShowDialog(false);
  };

  const handleViewReferrals = () => {
    handleDismiss();
    // Navigation will happen via the Link component
  };

  return (
    <Dialog open={showDialog} onOpenChange={setShowDialog}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center">
              <Gift className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <DialogTitle className="text-xl">Referral Bonus Unlocked! 🎉</DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground">
            Thank you for joining through a referral link
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          {/* Bonus Amount Card */}
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 p-6 rounded-lg border border-emerald-200 dark:border-emerald-800">
            <p className="text-sm text-muted-foreground mb-2">Your Referral Bonus</p>
            <div className="flex items-baseline gap-3">
              <div className="text-4xl font-bold text-emerald-600 dark:text-emerald-400">
                +${bonusAmount.toFixed(2)}
              </div>
              <p className="text-sm text-muted-foreground">
                in bonus credits
              </p>
            </div>
            <p className="text-sm text-muted-foreground mt-3">
              Plus your $5 in trial credits = <span className="font-semibold text-emerald-600 dark:text-emerald-400">${totalCredits.toFixed(2)} total</span>
            </p>
          </div>

          {/* How it works */}
          <div className="bg-muted/50 p-4 rounded-lg space-y-3">
            <h4 className="font-semibold text-sm">How to maximize your bonus:</h4>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li className="flex items-center gap-2">
                <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-semibold text-primary">1</span>
                </div>
                <span>Add $3 to unlock both trial + bonus credits</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-semibold text-primary">2</span>
                </div>
                <span>Share your referral link to earn more bonuses</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-semibold text-primary">3</span>
                </div>
                <span>Each successful referral earns you credits</span>
              </li>
            </ul>
          </div>

          {/* CTA */}
          <p className="text-sm text-center text-muted-foreground">
            Ready to start using your credits? Add payment now or explore the platform with your trial credits.
          </p>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleDismiss}
            className="w-full sm:w-auto"
          >
            Explore Platform
          </Button>
          <div className="flex gap-2 w-full sm:w-auto">
            <Link href="/settings/referrals" className="w-full sm:flex-1" onClick={handleViewReferrals}>
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2"
              >
                <Share2 className="h-4 w-4" />
                Share & Earn
              </Button>
            </Link>
            <Link href="/settings/credits" className="w-full sm:flex-1" onClick={handleViewReferrals}>
              <Button
                type="button"
                className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 gap-2"
              >
                Add Payment
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
