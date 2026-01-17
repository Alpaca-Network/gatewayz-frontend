"use client";

import { useEffect, Suspense, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { syncPrivyToGatewayz } from '@/integrations/privy/auth-sync';

/**
 * Build a redirect URL with optional ref code, handling edge cases
 * for malformed URLs that end with '?' or '&'
 */
function buildRedirectUrl(baseUrl: string, refCode: string | null): string {
  if (!refCode) {
    return baseUrl;
  }

  // Clean up any trailing ? or & from the base URL
  const cleanedUrl = baseUrl.replace(/[?&]+$/, '');

  // Determine the appropriate separator
  const separator = cleanedUrl.includes('?') ? '&' : '?';

  return `${cleanedUrl}${separator}ref=${refCode}`;
}

/**
 * Build desktop deep link callback URL with auth data
 */
function buildDesktopCallbackUrl(
  apiKey: string,
  userId: number,
  email: string | null,
  privyUserId: string
): string {
  const params = new URLSearchParams({
    token: apiKey,
    user_id: String(userId),
    privy_user_id: privyUserId,
    ...(email && { email }),
  });
  return `gatewayz://auth/callback?${params.toString()}`;
}

/**
 * Deep link redirect timeout in milliseconds.
 * If the deep link doesn't trigger app navigation within this time,
 * we show an error to the user.
 */
const DEEP_LINK_TIMEOUT_MS = 5000;

function LoginContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { login, authenticated, ready, user, getAccessToken } = usePrivy();
  const hasAutoTriggeredLogin = useRef(false);
  const hasHandledDesktopAuth = useRef(false);
  const [isProcessingDesktopAuth, setIsProcessingDesktopAuth] = useState(false);
  const [desktopAuthError, setDesktopAuthError] = useState<string | null>(null);

  // Get the return URL from query params (defaults to /chat)
  const returnUrl = searchParams?.get('returnUrl') || '/chat';
  const refCode = searchParams?.get('ref');
  // Check if this is a desktop app login request
  const isDesktopLogin = searchParams?.get('desktop') === 'true';

  useEffect(() => {
    // Handle authenticated users
    if (ready && authenticated && user) {
      // For desktop logins, sync with backend and redirect via deep link
      if (isDesktopLogin && !hasHandledDesktopAuth.current) {
        hasHandledDesktopAuth.current = true;
        setIsProcessingDesktopAuth(true);

        (async () => {
          try {
            console.log('[Login] Desktop auth: syncing with backend...');

            // Get Privy access token
            const privyAccessToken = await getAccessToken();

            // Sync with Gatewayz backend to get API key
            const { authResponse } = await syncPrivyToGatewayz(user, privyAccessToken, null);

            if (!authResponse.api_key) {
              throw new Error('No API key received from backend');
            }

            // Get user email from linked accounts
            const emailAccount = user.linkedAccounts?.find(
              (account: any) => account.type === 'email'
            );
            const email = emailAccount ? (emailAccount as any).email : null;

            // Build the deep link callback URL
            const callbackUrl = buildDesktopCallbackUrl(
              authResponse.api_key,
              authResponse.user_id,
              email,
              user.id
            );

            console.log('[Login] Desktop auth: redirecting to deep link...');

            // Set a timeout to show an error if the deep link doesn't work
            // This handles cases where the protocol handler isn't registered
            const timeoutId = setTimeout(() => {
              console.error('[Login] Desktop auth: deep link redirect timed out');
              setDesktopAuthError(
                'Could not connect to desktop app. Please ensure GatewayZ is installed and running.'
              );
              setIsProcessingDesktopAuth(false);
            }, DEEP_LINK_TIMEOUT_MS);

            // Store timeout ID in window so we can clear it if page unloads (successful redirect)
            (window as any).__desktopAuthTimeoutId = timeoutId;

            // Clear timeout if page unloads (indicates successful redirect)
            const handleUnload = () => {
              clearTimeout(timeoutId);
            };
            window.addEventListener('beforeunload', handleUnload);

            // Redirect to the desktop app via deep link
            window.location.href = callbackUrl;
          } catch (error) {
            console.error('[Login] Desktop auth error:', error);
            setDesktopAuthError(
              error instanceof Error ? error.message : 'Authentication failed'
            );
            setIsProcessingDesktopAuth(false);
          }
        })();
        return;
      }

      // For web logins, redirect to the return URL
      if (!isDesktopLogin) {
        const redirectUrl = buildRedirectUrl(returnUrl, refCode);
        router.push(redirectUrl);
      }
    }
  }, [ready, authenticated, user, router, returnUrl, refCode, isDesktopLogin, getAccessToken]);

  useEffect(() => {
    // Auto-trigger Privy login modal for unauthenticated users
    // Only trigger once to avoid repeated modal opens
    if (ready && !authenticated && !hasAutoTriggeredLogin.current) {
      hasAutoTriggeredLogin.current = true;
      login();
    }
  }, [ready, authenticated, login]);

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

  if (desktopAuthError) {
    return (
      <div className="flex min-h-[calc(100vh-200px)] items-center justify-center">
        <div className="text-center max-w-md px-4">
          <p className="text-destructive font-medium mb-2">Authentication Failed</p>
          <p className="text-muted-foreground text-sm mb-4">{desktopAuthError}</p>
          <button
            onClick={() => {
              setDesktopAuthError(null);
              hasHandledDesktopAuth.current = false;
              hasAutoTriggeredLogin.current = false;
            }}
            className="text-primary underline text-sm"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (isProcessingDesktopAuth) {
    return (
      <div className="flex min-h-[calc(100vh-200px)] items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Connecting to desktop app...</p>
          <p className="text-muted-foreground text-sm mt-2">You can close this window after being redirected.</p>
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
    <div className="flex min-h-[calc(100vh-200px)] items-center justify-center">
      <div className="text-center">
        <p className="text-muted-foreground">Redirecting to login...</p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-[calc(100vh-200px)] items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
