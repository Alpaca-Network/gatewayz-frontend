"use client";

import { useEffect, useState } from 'react';
import { Gift, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getReferralCode, getReferralSource } from '@/lib/referral';
import { getUserData } from '@/lib/api';
import { usePrivy } from '@privy-io/react-auth';

export function ReferralToast() {
  const [showToast, setShowToast] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const { login } = usePrivy();

  useEffect(() => {
    // Don't show if user is already authenticated
    const userData = getUserData();
    if (userData) {
      return;
    }

    // Check if user dismissed the toast this session
    const dismissed = sessionStorage.getItem('gatewayz_referral_toast_dismissed');
    if (dismissed) {
      return;
    }

    // Check for referral code
    const code = getReferralCode();
    const source = getReferralSource();

    // Only show if there's a referral code from URL (new visit)
    if (code && source === 'url') {
      setReferralCode(code);
      setShowToast(true);
    }
  }, []);

  const handleSignUp = () => {
    login();
  };

  const handleDismiss = () => {
    setShowToast(false);
    // Store dismissal in sessionStorage so it doesn't show again this session
    sessionStorage.setItem('gatewayz_referral_toast_dismissed', 'true');
  };

  if (!showToast || !referralCode) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-5 duration-500">
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg shadow-lg border border-purple-400/20 max-w-sm">
        <div className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
                <Gift className="h-5 w-5" />
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold mb-1">
                You've been referred!
              </h3>
              <p className="text-xs text-white/90 mb-3">
                A friend invited you to Gatewayz. Sign up now to get started with free trial credits!
              </p>

              <Button
                onClick={handleSignUp}
                size="sm"
                className="w-full bg-white text-purple-600 hover:bg-white/90 font-semibold"
              >
                Sign Up & Get Credits
              </Button>
            </div>

            <button
              onClick={handleDismiss}
              className="flex-shrink-0 p-1 rounded-md text-white/80 hover:bg-white/20 transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
