"use client";

import { useEffect, Suspense, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';

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

function SigninContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { login, authenticated, ready } = usePrivy();
  const hasAutoTriggeredLogin = useRef(false);

  // Get the return URL from query params (defaults to /chat)
  const returnUrl = searchParams?.get('returnUrl') || '/chat';
  const refCode = searchParams?.get('ref');

  useEffect(() => {
    // Redirect authenticated users to the return URL
    if (ready && authenticated) {
      const redirectUrl = buildRedirectUrl(returnUrl, refCode);
      router.push(redirectUrl);
    }
  }, [ready, authenticated, router, returnUrl, refCode]);

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
        <p className="text-muted-foreground">Redirecting to sign in...</p>
      </div>
    </div>
  );
}

export default function SigninPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-[calc(100vh-200px)] items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <SigninContent />
    </Suspense>
  );
}
