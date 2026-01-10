"use client";

import { useEffect, Suspense, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Gift } from 'lucide-react';
import { storeReferralCode } from '@/lib/referral';
import { trackTwitterSignupClick } from '@/components/analytics/twitter-pixel';

function SignupContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { login, authenticated, ready } = usePrivy();
  const hasAutoTriggeredLogin = useRef(false);

  // Get the return URL from query params (defaults to /chat)
  const returnUrl = searchParams?.get('returnUrl') || '/chat';
  const refCode = searchParams?.get('ref');

  useEffect(() => {
    // Handle referral code storage and authenticated user redirect in a single effect
    // to prevent race condition where redirect could happen before referral code is stored

    // First, capture and store referral code if present
    if (refCode) {
      console.log('Referral code detected:', refCode);
      // Store referral code using safe storage for use during authentication
      storeReferralCode(refCode, 'signup');
    }

    // Then, redirect authenticated users to the return URL
    // This ensures referral code is stored before redirect happens
    if (ready && authenticated) {
      // If there's a ref code, include it in the redirect
      const redirectUrl = refCode ? `${returnUrl}${returnUrl.includes('?') ? '&' : '?'}ref=${refCode}` : returnUrl;
      router.push(redirectUrl);
    }
  }, [ready, authenticated, router, returnUrl, refCode]);

  useEffect(() => {
    // Auto-trigger Privy login modal for unauthenticated users
    // Only trigger once to avoid repeated modal opens
    if (ready && !authenticated && !hasAutoTriggeredLogin.current) {
      hasAutoTriggeredLogin.current = true;

      // Track Twitter conversion for ad attribution
      trackTwitterSignupClick();

      // Auto-open the Privy login modal
      login();
    }
  }, [ready, authenticated, login]);

  const handleSignup = () => {
    if (!ready) {
      return;
    }

    if (authenticated) {
      const redirectUrl = refCode ? `${returnUrl}${returnUrl.includes('?') ? '&' : '?'}ref=${refCode}` : returnUrl;
      router.push(redirectUrl);
      return;
    }

    // Track Twitter conversion for ad attribution
    trackTwitterSignupClick();

    login();
  };

  if (!ready) {
    return (
      <div className="flex min-h-[calc(100vh-200px)] items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (authenticated) {
    return (
      <div className="flex min-h-[calc(100vh-200px)] items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-200px)] items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Gift className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">Welcome to Gatewayz!</CardTitle>
          <CardDescription className="text-base">
            {refCode ? (
              <>
                You've been invited! Sign up now to get <span className="font-semibold text-foreground">bonus credits</span>.
              </>
            ) : (
              <>
                Sign up to access AI models and start building with Gatewayz.
              </>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {refCode && (
            <div className="bg-muted p-4 rounded-lg text-center">
              <p className="text-sm text-muted-foreground mb-1">Referral Code</p>
              <p className="text-lg font-mono font-bold">{refCode}</p>
            </div>
          )}

          <Button
            onClick={handleSignup}
            disabled={!ready || authenticated}
            size="lg"
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Sign Up Now
          </Button>

          <div className="bg-muted/50 p-4 rounded-lg space-y-2">
            <h4 className="font-semibold text-sm">What you'll get:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li className="flex items-center gap-2">
                <span className="text-green-600">✓</span>
                Access to 10,000+ AI models
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-600">✓</span>
                $3 in free trial credits
              </li>
              {refCode && (
                <li className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  Bonus credits from referral
                </li>
              )}
              <li className="flex items-center gap-2">
                <span className="text-green-600">✓</span>
                Advanced AI routing & analytics
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-[calc(100vh-200px)] items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <SignupContent />
    </Suspense>
  );
}
