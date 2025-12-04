"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useGatewayzAuth } from "@/context/gatewayz-auth-context";
import {
  getSessionTransferParams,
  cleanupSessionTransferParams,
  storeSessionTransferToken,
  getStoredSessionTransferToken,
} from "@/integrations/privy/auth-session-transfer";
import { saveApiKey, saveUserData, type UserData } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

// Cache for user data fetches to avoid duplicate requests within same session
const userDataCache = new Map<string, { data: UserData; timestamp: number }>();
const CACHE_TTL = 1 * 60 * 1000; // 1 minute cache

function getCachedUserData(token: string): UserData | null {
  const cached = userDataCache.get(token);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  userDataCache.delete(token); // Clean up expired cache
  return null;
}

function setCachedUserData(token: string, data: UserData): void {
  userDataCache.set(token, { data, timestamp: Date.now() });
}

// For testing: export a function to clear the cache
if (typeof window !== 'undefined' && (window as any).__testing) {
  (window as any).__clearSessionInitializerCache = () => userDataCache.clear();
}

async function fetchUserDataOptimized(token: string): Promise<UserData | null> {
  // Check cache first
  const cached = getCachedUserData(token);
  if (cached) {
    console.log("[SessionInit] Using cached user data");
    return cached;
  }

  const startTime = Date.now();
  const controller = new AbortController();
  let timeoutId: NodeJS.Timeout | undefined;

  try {
    console.log("[SessionInit] Fetching user data from backend with token:", token.substring(0, 20) + "...");

    // Set timeout with controller abort
    timeoutId = setTimeout(() => {
      controller.abort();
    }, 10000); // Increased to 10 second timeout for user fetch

    const userResponse = await fetch("/api/user/me", {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });

    // Clear timeout immediately after fetch completes (before any await)
    clearTimeout(timeoutId);
    timeoutId = undefined;

    const duration = Date.now() - startTime;
    console.log(`[SessionInit] User data fetch completed in ${duration}ms`);

    if (userResponse.ok) {
      const userData = await userResponse.json() as UserData;
      console.log("[SessionInit] User data fetched successfully:", {
        user_id: userData.user_id,
        credits: userData.credits,
        tier: userData.tier,
        email: userData.email,
      });

      // Cache the result for fast re-access
      setCachedUserData(token, userData);
      return userData;
    } else {
      const responseText = await userResponse.text().catch(() => "(unable to read response)");
      console.error("[SessionInit] Failed to fetch user data. Status:", userResponse.status, "Response:", responseText.substring(0, 200));

      // Clear invalid token from storage if we get 401/403
      if (userResponse.status === 401 || userResponse.status === 403) {
        console.warn("[SessionInit] Token appears invalid (401/403), will let auth context handle it");
      }

      return null;
    }
  } catch (error) {
    // Clear timeout if it hasn't been cleared yet
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
      timeoutId = undefined;
    }

    const errorMsg = error instanceof Error ? error.message : String(error);
    const duration = Date.now() - startTime;

    if (errorMsg.includes("aborted") || errorMsg.includes("timeout")) {
      console.error(`[SessionInit] User data fetch timeout after ${duration}ms - network may be slow`);

      // Send timeout event to Sentry for monitoring
      if (typeof window !== 'undefined' && duration > 8000) {
        import('@sentry/nextjs').then((Sentry) => {
          Sentry.captureMessage("Authentication timeout - stuck in authenticating state", {
            level: 'error',
            tags: {
              error_type: 'auth_timeout',
              duration_ms: duration.toString(),
            },
            contexts: {
              auth: {
                timeout_threshold: '10000ms',
                actual_duration: `${duration}ms`,
                endpoint: '/api/user/me',
              },
            },
          });
        }).catch(() => {
          // Silently fail if Sentry is unavailable
        });
      }
    } else {
      console.error("[SessionInit] Error fetching user data:", error);
    }

    // Return null on timeout or network error - context will handle it
    return null;
  }
}

export function SessionInitializer() {
  const router = useRouter();
  const { status, refresh, login, privyReady } = useGatewayzAuth();
  const initializedRef = useRef(false);
  const waitingForPrivyRef = useRef(false);
  const actionProcessedRef = useRef(false);
  const referralToastShownRef = useRef(false);

  useEffect(() => {
    // Skip if already initialized to prevent double execution
    if (initializedRef.current) return;

    // Only proceed if Privy is ready and we have an action to process
    // Don't mark as initialized if waiting for Privy, so we'll retry when Privy is ready
    try {
      const { action } = getSessionTransferParams();
      if (action && !privyReady) {
        // Only log once to avoid console spam
        if (!waitingForPrivyRef.current) {
          console.log("[SessionInit] Privy not ready yet, waiting for Privy to initialize before processing action");
          waitingForPrivyRef.current = true;
        }
        return; // Don't mark initializedRef.current as true - wait for Privy
      } else if (waitingForPrivyRef.current && privyReady) {
        // Privy is now ready, log the transition
        console.log("[SessionInit] Privy is now ready, proceeding with session initialization");
        waitingForPrivyRef.current = false;
      }
    } catch (e) {
      // If we can't get session params, just continue with initialization
      // Errors during actual initialization will be caught below
      console.error("[SessionInit] Error checking session transfer params:", e);
    }

    async function initializeSession() {
      // Check for URL params from session transfer
      const { token, userId, returnUrl } = getSessionTransferParams();

      console.log("[SessionInit] Session initialization started", {
        hasToken: !!token,
        tokenPreview: token ? token.substring(0, 20) + "..." : "none",
        hasUserId: !!userId,
      });

      if (token && userId) {
        console.log("[SessionInit] Session transfer params detected", {
          hasReturnUrl: !!returnUrl,
        });

        // Store token for persistence
        storeSessionTransferToken(token, userId);

        // Clean up URL immediately to prevent browser history pollution
        try {
          cleanupSessionTransferParams();
        } catch (cleanupError) {
          console.warn("[SessionInit] Warning: Failed to cleanup session transfer params:", cleanupError);
          // Continue anyway - session transfer can still proceed
        }

        try {
          // Fetch user data with proper async/await flow
          const userData = await fetchUserDataOptimized(token);

          // Save API key to localStorage (must happen after userData fetch for proper deduplication)
          saveApiKey(token);

          if (userData) {
            // Save complete user data to localStorage
            const userDataToSave: UserData = {
              user_id: userData.user_id,
              api_key: token,
              auth_method: userData.auth_method || "session_transfer",
              privy_user_id: userData.privy_user_id || userId.toString(),
              display_name: userData.display_name || userData.email || "User",
              email: userData.email || "",
              credits: Math.floor(userData.credits ?? 0),
              tier: userData.tier?.toLowerCase() as UserData["tier"],
              tier_display_name: userData.tier_display_name,
              subscription_status: userData.subscription_status,
              subscription_end_date: userData.subscription_end_date,
            };

            try {
              saveUserData(userDataToSave);
              setCachedUserData(token, userDataToSave);
              console.log("[SessionInit] User data saved to localStorage");
            } catch (saveError) {
              console.error("[SessionInit] Failed to save user data to localStorage:", saveError);
              // Continue anyway - API key is already saved, auth will sync
            }
          }

          // Refresh auth context to update state from localStorage
          // IMPORTANT: Wait for refresh to complete to ensure auth state is synced before page content loads
          await refresh().catch((error) => {
            console.error("[SessionInit] Error refreshing auth after user data fetch:", error);
          });
        } catch (error) {
          console.error("[SessionInit] Error during session init:", error);
          // Still trigger refresh even if something unexpected happens
          // IMPORTANT: Wait for refresh to ensure auth state is properly updated
          await refresh().catch((err) => {
            console.error("[SessionInit] Error refreshing auth after error:", err);
          });
        }

        // Redirect to return URL if provided (after refresh completes)
        if (returnUrl) {
          router.push(returnUrl);
        }

        return;
      }

      // Check for stored session transfer token (fallback)
      // Only use if we don't already have a valid API key
      const existingApiKey = localStorage.getItem("gatewayz_api_key");
      const { token: storedToken, userId: storedUserId } =
        getStoredSessionTransferToken();

      if (storedToken && storedUserId && !existingApiKey) {
        console.log("[SessionInit] Using stored session transfer token from sessionStorage");

        try {
          // Fetch user data with proper async/await flow
          const userData = await fetchUserDataOptimized(storedToken);

          // Restore API key from sessionStorage (must happen after userData fetch for proper deduplication)
          saveApiKey(storedToken);

          if (userData) {
            // Save complete user data to localStorage
            const userDataToSave: UserData = {
              user_id: userData.user_id,
              api_key: storedToken,
              auth_method: userData.auth_method || "session_transfer",
              privy_user_id: userData.privy_user_id || storedUserId.toString(),
              display_name: userData.display_name || userData.email || "User",
              email: userData.email || "",
              credits: Math.floor(userData.credits ?? 0),
              tier: userData.tier?.toLowerCase() as UserData["tier"],
              tier_display_name: userData.tier_display_name,
              subscription_status: userData.subscription_status,
              subscription_end_date: userData.subscription_end_date,
            };

            try {
              saveUserData(userDataToSave);
              setCachedUserData(storedToken, userDataToSave);
              console.log("[SessionInit] User data saved to localStorage (stored token)");
            } catch (saveError) {
              console.error("[SessionInit] Failed to save user data from stored token:", saveError);
              // Continue anyway - API key is already saved, auth will sync
            }
          }

          // Refresh auth context to update state from localStorage
          // IMPORTANT: Wait for refresh to complete to ensure auth state is synced
          await refresh().catch((error) => {
            console.error("[SessionInit] Error refreshing auth after stored token fetch:", error);
          });
        } catch (error) {
          console.error("[SessionInit] Error during stored token session init:", error);
          // Still trigger refresh on error
          // IMPORTANT: Wait for refresh to ensure auth state is properly updated
          await refresh().catch((err) => {
            console.error("[SessionInit] Error refreshing auth after stored token error:", err);
          });
        }

        return;
      }
    }

    // Execute initialization and only mark as complete when done
    initializeSession().then(() => {
      initializedRef.current = true;
    }).catch((error) => {
      console.error("[SessionInit] Error initializing session:", error);
      initializedRef.current = true; // Mark as initialized even on error to avoid infinite retries
    });
  }, [refresh, router, privyReady]);

  useEffect(() => {
    if (actionProcessedRef.current) {
      return;
    }

    let currentAction: string | null = null;
    try {
      ({ action: currentAction } = getSessionTransferParams());
    } catch (error) {
      console.error("[SessionInit] Error checking session transfer params:", error);
      return;
    }

    if (!currentAction) {
      actionProcessedRef.current = true;
      return;
    }

    if (!privyReady) {
      console.log("[SessionInit] Privy not ready yet, waiting for Privy to initialize before processing action");
      return;
    }

    if (status === "authenticated") {
      actionProcessedRef.current = true;
      return;
    }

    if (status !== "unauthenticated") {
      return;
    }

    actionProcessedRef.current = true;

    const processAction = async () => {
      console.log(
        "[SessionInit] Action parameter detected, opening Privy popup",
        { action: currentAction, status, privyReady }
      );

      try {
        cleanupSessionTransferParams();
      } catch (cleanupError) {
        console.warn("[SessionInit] Warning: Failed to cleanup session transfer params:", cleanupError);
      }

      try {
        await login();
        console.log("[SessionInit] Login triggered successfully for action:", currentAction);
      } catch (error) {
        console.error("[SessionInit] Failed to trigger login for action:", currentAction, error);
      }
    };

    processAction();
  }, [login, privyReady, status]);

  // Handle referral code toast notification
  useEffect(() => {
    // Wait until user is authenticated
    if (status !== "authenticated") {
      return;
    }

    // Check for referral code in URL or localStorage
    if (typeof window === 'undefined') {
      return;
    }

    // Check if toast has already been shown (using sessionStorage for persistence across remounts)
    const toastShown = sessionStorage.getItem('gatewayz_referral_toast_shown');
    if (toastShown === 'true') {
      return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref') || localStorage.getItem('gatewayz_referral_code');

    if (refCode) {
      // Mark as shown in sessionStorage to persist across remounts
      sessionStorage.setItem('gatewayz_referral_toast_shown', 'true');
      referralToastShownRef.current = true;

      // Show toast notification
      toast({
        title: "Welcome! You've been referred!",
        description: "Bonus credits will be added to your account after signup.",
        variant: "default",
      });

      // Clean up the ref parameter from URL if present
      if (urlParams.get('ref')) {
        try {
          urlParams.delete('ref');
          const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '');
          window.history.replaceState({}, document.title, newUrl);
          console.log('[SessionInit] Cleaned up ref parameter from URL');
        } catch (error) {
          console.warn('[SessionInit] Failed to cleanup ref parameter:', error);
        }
      }

      console.log('[SessionInit] Referral toast shown for code:', refCode);
    }
  }, [status]);

  return null;
}
