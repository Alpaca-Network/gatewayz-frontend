"use client";

import { useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { savePreviewHostname, isVercelPreviewDeployment } from '@/lib/preview-hostname-handler';

/**
 * Preview Hostname Interceptor
 *
 * This component intercepts Privy login events on Vercel preview deployments
 * and saves the preview hostname before the OAuth redirect happens.
 *
 * This ensures that after OAuth authentication (when the provider redirects back),
 * we can restore the correct preview URL instead of being sent to production.
 */
export function PreviewHostnameInterceptor() {
  const { ready, authenticated } = usePrivy();

  useEffect(() => {
    // Only run on preview deployments
    if (!isVercelPreviewDeployment()) {
      return;
    }

    // Save hostname whenever Privy is ready
    if (ready) {
      savePreviewHostname();
    }

    // Monitor authentication changes
    // When user initiates login, hostname is already saved
    // When user returns from OAuth, the restoration logic in the handler will run
  }, [ready, authenticated]);

  useEffect(() => {
    // Listen for when Privy login modal opens
    const handlePrivyModalOpen = () => {
      if (isVercelPreviewDeployment()) {
        console.log('[Preview] Privy login initiated, ensuring hostname is saved');
        savePreviewHostname();
      }
    };

    // Listen for clicks on login-related elements
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      // Check if click is on a login button or related element
      const isLoginButton = target.closest('button[data-privy-login]') ||
                           target.closest('[data-auth-action="login"]') ||
                           target.textContent?.toLowerCase().includes('sign in') ||
                           target.textContent?.toLowerCase().includes('log in');

      if (isLoginButton && isVercelPreviewDeployment()) {
        console.log('[Preview] Login button clicked, saving hostname');
        savePreviewHostname();
      }
    };

    // Listen for Privy-specific events
    if (typeof window !== 'undefined') {
      window.addEventListener('privy:modal:open', handlePrivyModalOpen);
      document.addEventListener('click', handleClick, true); // Use capture phase
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('privy:modal:open', handlePrivyModalOpen);
        document.removeEventListener('click', handleClick, true);
      }
    };
  }, []);

  // This component doesn't render anything
  return null;
}
