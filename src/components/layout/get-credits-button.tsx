"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { trackTwitterSignupClick } from "@/components/analytics/twitter-pixel";
import { getUserData, AUTH_REFRESH_COMPLETE_EVENT } from '@/lib/api';
import { getUserTier } from '@/lib/tier-utils';

export function GetCreditsButton() {
  const [shouldShow, setShouldShow] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkVisibility = useCallback(() => {
    const userData = getUserData();

    if (!userData) {
      // No user data - show button (guest/logged out users)
      setShouldShow(true);
      return true;
    }

    // Hide button for pro/max users
    const tier = getUserTier(userData);
    if (tier === 'pro' || tier === 'max') {
      setShouldShow(false);
      return false;
    }

    // Hide button for users with credits (credits are stored in cents, 100 cents = $1)
    // Consider users with more than $0.50 (50 cents) as having credits
    const credits = userData.credits ?? 0;
    if (credits > 50) {
      setShouldShow(false);
      return false;
    }

    // Show button for basic users with low/no credits
    setShouldShow(true);
    return true;
  }, []);

  // Manage polling interval - only poll when button is visible
  const startPolling = useCallback(() => {
    if (intervalRef.current) return; // Already polling
    intervalRef.current = setInterval(() => {
      const isVisible = checkVisibility();
      // Stop polling if button becomes hidden
      if (!isVisible && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }, 5000);
  }, [checkVisibility]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    // Initial check
    const isVisible = checkVisibility();

    // Only start polling if button is visible
    if (isVisible) {
      startPolling();
    }

    // Listen for storage events (updates from other tabs)
    const handleStorageChange = () => {
      const isVisible = checkVisibility();
      if (isVisible) {
        startPolling();
      } else {
        stopPolling();
      }
    };
    window.addEventListener('storage', handleStorageChange);

    // Listen for AUTH_REFRESH_COMPLETE_EVENT for same-tab auth updates
    // This fires when auth sync completes (e.g., after login, credit purchase, tier upgrade)
    const handleAuthRefreshComplete = () => {
      const isVisible = checkVisibility();
      if (isVisible) {
        startPolling();
      } else {
        stopPolling();
      }
    };
    window.addEventListener(AUTH_REFRESH_COMPLETE_EVENT, handleAuthRefreshComplete);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener(AUTH_REFRESH_COMPLETE_EVENT, handleAuthRefreshComplete);
      stopPolling();
    };
  }, [checkVisibility, startPolling, stopPolling]);

  const handleClick = () => {
    // Track Twitter conversion for ad attribution
    trackTwitterSignupClick();
  };

  // Don't render if should not show
  if (!shouldShow) {
    return null;
  }

  return (
    <Link href="/onboarding" className="relative group inline-block" onClick={handleClick}>
      {/* Multi-layered LED-style glow with color shifting */}
      <div className="absolute -inset-[3px] rounded-lg opacity-90 blur-md animate-led-shimmer"></div>
      <div className="absolute -inset-[2px] rounded-lg opacity-80 blur-sm animate-led-shimmer" style={{ animationDelay: '0.5s' }}></div>

      {/* Elevated neon border - visible underneath */}
      <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 opacity-100 animate-led-shimmer" style={{ top: '2px' }}></div>

      {/* Button with elevation effect */}
      <div className="relative bg-black hover:bg-gray-900 text-white h-10 px-3 sm:px-6 rounded-lg font-semibold transition-all duration-200 active:translate-y-[2px] active:shadow-none shadow-[0_2px_0_0_rgba(59,130,246,0.5),0_4px_12px_rgba(59,130,246,0.4)] flex items-center justify-center">
        <span className="relative z-10 flex items-center justify-center gap-2">
          <span className="text-white font-semibold tracking-tight sm:tracking-wide uppercase text-xs sm:text-sm whitespace-nowrap">
            Get Free Credits
          </span>
        </span>
      </div>

      <style jsx>{`
        @keyframes led-shimmer {
          0%, 100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }

        .animate-led-shimmer {
          background: linear-gradient(90deg, #06b6d4, #3b82f6, #8b5cf6, #ec4899, #06b6d4, #3b82f6);
          background-size: 200% 200%;
          animation: led-shimmer 4s ease-in-out infinite;
        }
      `}</style>
    </Link>
  );
}
