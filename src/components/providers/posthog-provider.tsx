"use client";

import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { useEffect, type ReactNode } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

interface PostHogProviderProps {
  children: ReactNode;
}

export function PostHogProvider({ children }: PostHogProviderProps) {
  useEffect(() => {
    const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;

    if (!posthogKey || !posthogHost) {
      console.warn('PostHog environment variables not set');
      return;
    }

    // Detect if on mobile to disable expensive features
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

    // Use timeout to prevent PostHog from blocking page load on slow networks
    const initTimeout = setTimeout(() => {
      try {
        posthog.init(posthogKey, {
          api_host: posthogHost,
          person_profiles: 'identified_only',
          capture_pageview: false, // We'll capture pageviews manually
          capture_pageleave: true,
          // Mobile optimization: disable expensive features on small screens
          disable_session_recording: isMobile, // Don't record sessions on mobile
        });

        // Only initialize session recording on desktop after page is interactive
        if (!isMobile) {
          // Defer session recording initialization to avoid blocking main thread
          if (typeof requestIdleCallback !== 'undefined') {
            requestIdleCallback(() => {
              try {
                posthog.startSessionRecording?.();
              } catch (e) {
                console.warn('Failed to start PostHog session recording', e);
              }
            });
          } else {
            // Fallback for browsers without requestIdleCallback
            setTimeout(() => {
              try {
                posthog.startSessionRecording?.();
              } catch (e) {
                console.warn('Failed to start PostHog session recording', e);
              }
            }, 3000);
          }
        }
      } catch (error) {
        console.warn('Failed to initialize PostHog:', error);
      }
    }, 100); // 100ms delay allows critical page rendering to start first

    return () => clearTimeout(initTimeout);
  }, []);

  return <PHProvider client={posthog}>{children}</PHProvider>;
}

// Hook to track pageviews
export function PostHogPageView(): null {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (pathname) {
      let url = window.origin + pathname;
      if (searchParams && searchParams.toString()) {
        url = url + `?${searchParams.toString()}`;
      }
      posthog.capture('$pageview', {
        $current_url: url,
      });
    }
  }, [pathname, searchParams]);

  return null;
}
