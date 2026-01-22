"use client";

import { useEffect, Suspense, useRef, useMemo, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { useGatewayzAuth } from '@/context/gatewayz-auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Gift } from 'lucide-react';
import { storeReferralCode } from '@/lib/referral';
import { trackTwitterSignupClick } from '@/components/analytics/twitter-pixel';

/**
 * SignupCardContent - The actual signup card content
 * Renders immediately with proper visual structure for better FCP/LCP
 */
function SignupCardContent({
  refCode,
  ready,
  authStatus,
  onSignup
}: {
  refCode: string | null;
  ready: boolean;
  authStatus: 'idle' | 'unauthenticated' | 'authenticating' | 'authenticated' | 'error';
  onSignup: () => void;
}) {
  // Show loading state when Privy isn't ready or when authentication is in progress
  const isLoading = !ready || authStatus === 'authenticating';
  const isAuthenticated = authStatus === 'authenticated';

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
            onClick={onSignup}
            disabled={isLoading || isAuthenticated}
            size="lg"
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></span>
                {authStatus === 'authenticating' ? 'Signing in...' : 'Loading...'}
              </span>
            ) : isAuthenticated ? (
              'Redirecting...'
            ) : (
              'Sign Up Now'
            )}
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

function SignupContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { login, authenticated, ready } = usePrivy();
  const { status: authStatus } = useGatewayzAuth();
  const hasAutoTriggeredLogin = useRef(false);

  // Track if the user was already authenticated when they landed on this page
  // This distinguishes between:
  // 1. Returning users who are already authenticated (should redirect immediately)
  // 2. New users who just signed up (auth context handles redirect to /onboarding)
  const wasAlreadyAuthenticatedRef = useRef<boolean | null>(null);

  // Capture initial auth state on mount
  useEffect(() => {
    if (wasAlreadyAuthenticatedRef.current === null && ready) {
      wasAlreadyAuthenticatedRef.current = authenticated && authStatus === 'authenticated';
    }
  }, [ready, authenticated, authStatus]);

  // Memoize query params to prevent unstable effect dependencies
  // This prevents redirect loops when searchParams object changes
  const returnUrl = useMemo(() => searchParams?.get('returnUrl') || '/chat', [searchParams]);
  const refCode = useMemo(() => searchParams?.get('ref'), [searchParams]);

  // Memoize redirect URL construction with proper encoding and hash handling
  const redirectUrl = useMemo(() => {
    if (!refCode) return returnUrl;

    // Parse the URL to handle hash fragments correctly
    // Query params must come BEFORE hash fragments per URL spec
    const hashIndex = returnUrl.indexOf('#');
    const hasHash = hashIndex !== -1;
    const baseUrl = hasHash ? returnUrl.slice(0, hashIndex) : returnUrl;
    const hashFragment = hasHash ? returnUrl.slice(hashIndex) : '';

    // Clean up any trailing ? or & from the base URL (edge case handling)
    const cleanedBaseUrl = baseUrl.replace(/[?&]+$/, '');

    // Check if URL already has query params
    const hasQueryParams = cleanedBaseUrl.includes('?');

    // Check if ref param already exists to avoid duplicates
    const urlObj = new URL(cleanedBaseUrl, 'http://dummy.com');
    if (urlObj.searchParams.has('ref')) {
      // Replace existing ref param
      urlObj.searchParams.set('ref', refCode);
      return `${urlObj.pathname}${urlObj.search}${hashFragment}`;
    }

    // Append ref param with proper encoding
    const separator = hasQueryParams ? '&' : '?';
    const encodedRef = encodeURIComponent(refCode);
    return `${cleanedBaseUrl}${separator}ref=${encodedRef}${hashFragment}`;
  }, [returnUrl, refCode]);

  useEffect(() => {
    // Handle referral code storage and authenticated user redirect in a single effect
    // to prevent race condition where redirect could happen before referral code is stored

    // First, capture and store referral code if present (can run before Privy is ready)
    if (refCode) {
      console.log('Referral code detected:', refCode);
      // Store referral code using safe storage for use during authentication
      storeReferralCode(refCode, 'signup');
    }

    // Only redirect users who were ALREADY authenticated when they landed on this page
    // For new signups, the auth context handles the redirect (to /onboarding for new users)
    // This prevents a race condition where:
    // 1. Privy's `authenticated` becomes true
    // 2. This effect tries to redirect to /chat
    // 3. Auth context later redirects to /onboarding
    // 4. User gets stuck in a loading state on /chat
    if (ready && authStatus === 'authenticated' && wasAlreadyAuthenticatedRef.current === true) {
      console.log('[Signup] Already authenticated user detected, redirecting to:', redirectUrl);
      router.push(redirectUrl);
    }
  }, [ready, authStatus, router, redirectUrl, refCode]);

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

  // Memoize signup handler for stable reference
  const handleSignup = useCallback(() => {
    if (!ready) {
      return;
    }

    // If user is already fully authenticated (not just in Privy, but Gatewayz too),
    // redirect them. This handles the case where an authenticated user clicks the button.
    if (authStatus === 'authenticated') {
      router.push(redirectUrl);
      return;
    }

    // Track Twitter conversion for ad attribution
    trackTwitterSignupClick();

    login();
  }, [ready, authStatus, router, redirectUrl, login]);

  // PERFORMANCE OPTIMIZATION: Render the full card UI immediately
  // The button shows loading state while Privy initializes
  // This dramatically improves FCP/LCP by showing meaningful content immediately
  return (
    <SignupCardContent
      refCode={refCode}
      ready={ready}
      authStatus={authStatus}
      onSignup={handleSignup}
    />
  );
}

/**
 * SignupCardSkeleton - Server-rendered fallback matching the actual card layout
 * This ensures good FCP/LCP by rendering meaningful content immediately
 */
function SignupCardSkeleton() {
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
            Sign up to access AI models and start building with Gatewayz.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            disabled
            size="lg"
            className="w-full bg-primary text-primary-foreground"
          >
            <span className="flex items-center gap-2">
              <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></span>
              Loading...
            </span>
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
    <Suspense fallback={<SignupCardSkeleton />}>
      <SignupContent />
    </Suspense>
  );
}
