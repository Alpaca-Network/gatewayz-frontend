"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useGatewayzAuth } from "@/context/gatewayz-auth-context";
import {
  getSessionTransferParams,
  cleanupSessionTransferParams,
  storeSessionTransferToken,
  getStoredSessionTransferToken,
  clearSessionTransferToken,
} from "@/integrations/privy/auth-session-transfer";
import {
  getSessionTransferCode,
  redeemSessionTransferCode,
  confirmAccountSwitch,
  accountLabel,
} from "@/integrations/privy/session-transfer-code";
import { getUserData, saveApiKey, saveUserData, type UserData } from "@/lib/api";
import { safeReturnUrl } from "@/lib/safe-return-url";

/**
 * The account this browser is already signed into, if any. `null` when there is
 * no stored API key. `user_id` is null when the key is there but no profile is.
 */
function currentSession(): { apiKey: string; user: UserData | null } | null {
  try {
    const apiKey = localStorage.getItem("gatewayz_api_key");
    if (!apiKey) {
      return null;
    }
    const user = typeof getUserData === "function" ? getUserData() : null;
    return { apiKey, user };
  } catch {
    return null;
  }
}

/**
 * Account-fixation guard: a transfer link (even one with a valid code) can be
 * made by someone else for THEIR account. If this browser is already signed in
 * as a different user, ask before switching. `alwaysAsk` is for the legacy
 * credential-in-URL path, which is only honoured with explicit consent.
 */
function confirmSessionTarget(
  incoming: { apiKey: string; userId: string | number; label: string },
  alwaysAsk: boolean
): boolean {
  const existing = currentSession();
  const sameUser =
    !!existing &&
    (existing.apiKey === incoming.apiKey ||
      (existing.user?.user_id != null && String(existing.user.user_id) === String(incoming.userId)));

  if (sameUser) {
    return true;
  }
  if (existing) {
    return confirmAccountSwitch(
      `You're signed in as ${accountLabel(existing.user)}. Switch to ${incoming.label}?`
    );
  }
  if (alwaysAsk) {
    return confirmAccountSwitch(`Sign in to Gatewayz as ${incoming.label}?`);
  }
  return true;
}

function toStoredUser(
  userData: UserData,
  apiKey: string,
  fallbackPrivyId: string
): UserData {
  return {
    user_id: userData.user_id,
    api_key: apiKey,
    auth_method: userData.auth_method || "session_transfer",
    privy_user_id: userData.privy_user_id || fallbackPrivyId,
    display_name: userData.display_name || userData.email || "User",
    email: userData.email || "",
    credits: userData.credits ?? 0,
    tier: userData.tier?.toLowerCase() as UserData["tier"],
    tier_display_name: userData.tier_display_name,
    subscription_status: userData.subscription_status,
    subscription_end_date: userData.subscription_end_date,
  };
}

/**
 * A transferred token is only accepted when the backend confirms it belongs to
 * the user id that came with it. This blocks crafted links that pair a token
 * with a mismatched/forged user id, and never persists a token the backend
 * did not validate (e.g. 401, timeout). See PR notes for remaining risk.
 */
function tokenMatchesUser(userData: UserData | null, expectedUserId: string): userData is UserData {
  return (
    !!userData &&
    userData.user_id !== undefined &&
    userData.user_id !== null &&
    String(userData.user_id) === String(expectedUserId)
  );
}

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
    console.log("[SessionInit] Fetching user data from backend");

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
        import('@/lib/global-error-handlers').then(({ rateLimitedCaptureMessage }) => {
          rateLimitedCaptureMessage("Authentication timeout - stuck in authenticating state", {
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
      const { token, userId, returnUrl: rawReturnUrl } = getSessionTransferParams();
      const transferCode = getSessionTransferCode();
      // Only same-origin relative paths; anything else is dropped (open-redirect guard)
      const returnUrl = rawReturnUrl ? safeReturnUrl(rawReturnUrl, "") : "";

      if (transferCode) {
        // Strip the code from the URL/history before anything else
        try {
          cleanupSessionTransferParams();
        } catch (cleanupError) {
          console.warn("[SessionInit] Warning: Failed to cleanup session transfer params:", cleanupError);
        }

        const result = await redeemSessionTransferCode(transferCode);
        if (result.status !== "ok") {
          if (result.status === "unavailable") {
            console.warn("[SessionInit] Transfer-code redeem unavailable; please sign in here");
          } else {
            console.warn("[SessionInit] Transfer code invalid or expired");
          }
          await refresh().catch((error) => {
            console.error("[SessionInit] Error refreshing auth after failed code redeem:", error);
          });
          return;
        }

        const session = result.session;
        const switchOk = confirmSessionTarget(
          {
            apiKey: session.api_key,
            userId: session.user_id,
            label: accountLabel(session),
          },
          false
        );
        if (!switchOk) {
          console.log("[SessionInit] Account switch declined; keeping current session");
          await refresh().catch((error) => {
            console.error("[SessionInit] Error refreshing auth after declined switch:", error);
          });
          return;
        }

        try {
          const userData = await fetchUserDataOptimized(session.api_key);
          if (userData && String(userData.user_id) !== String(session.user_id)) {
            console.error("[SessionInit] Redeemed key does not match its user; not persisting it");
            await refresh().catch(() => undefined);
            return;
          }

          saveApiKey(session.api_key);
          const profile: UserData = userData ?? {
            user_id: session.user_id,
            api_key: session.api_key,
            auth_method: (session.auth_method || "session_transfer") as UserData["auth_method"],
            privy_user_id: session.privy_user_id || "",
            display_name: session.display_name || session.email || "User",
            email: session.email || "",
            credits: 0,
          };
          try {
            const stored = toStoredUser(profile, session.api_key, session.privy_user_id || "");
            saveUserData(stored);
            setCachedUserData(session.api_key, stored);
          } catch (saveError) {
            console.error("[SessionInit] Failed to save user data to localStorage:", saveError);
          }
        } catch (error) {
          console.error("[SessionInit] Error during code session init:", error);
        }

        await refresh().catch((error) => {
          console.error("[SessionInit] Error refreshing auth after code redeem:", error);
        });
        if (returnUrl) {
          router.push(returnUrl);
        }
        return;
      }

      // LEGACY: ?token=&userId= (credential in the URL). Honoured only with
      // explicit consent from the person (see confirmSessionTarget).
      // TODO(session-transfer): remove this branch once the gatewayz-beta-landing
      // one-time-code PR has shipped and old links have aged out.
      if (token && userId) {
        console.log("[SessionInit] Session transfer params detected", {
          hasReturnUrl: !!returnUrl,
        });

        // Strip the token from the URL/history before doing anything else
        try {
          cleanupSessionTransferParams();
        } catch (cleanupError) {
          console.warn("[SessionInit] Warning: Failed to cleanup session transfer params:", cleanupError);
          // Continue anyway - session transfer can still proceed
        }

        try {
          // Fetch user data with proper async/await flow
          const userData = await fetchUserDataOptimized(token);

          if (!tokenMatchesUser(userData, userId)) {
            if (userData) {
              // Backend says the token belongs to someone else: reject outright
              console.error("[SessionInit] Session transfer rejected: token does not match userId");
              clearSessionTransferToken();
            } else {
              console.warn("[SessionInit] Session transfer token could not be verified; not persisting it");
            }
            await refresh().catch((error) => {
              console.error("[SessionInit] Error refreshing auth after rejected session transfer:", error);
            });
            return;
          }

          const consented = confirmSessionTarget(
            { apiKey: token, userId, label: accountLabel(userData) },
            true
          );
          if (!consented) {
            console.log("[SessionInit] Legacy session transfer declined");
            clearSessionTransferToken();
            await refresh().catch((error) => {
              console.error("[SessionInit] Error refreshing auth after declined transfer:", error);
            });
            return;
          }

          // Only a token the person accepted is kept for reload recovery
          storeSessionTransferToken(token, userId);

          // Save API key to localStorage (only after the backend verified it)
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
              credits: userData.credits ?? 0,
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

          if (!tokenMatchesUser(userData, storedUserId)) {
            if (userData) {
              console.error("[SessionInit] Stored session transfer rejected: token does not match userId");
              clearSessionTransferToken();
            } else {
              console.warn("[SessionInit] Stored session transfer token could not be verified; not persisting it");
            }
            await refresh().catch((error) => {
              console.error("[SessionInit] Error refreshing auth after rejected stored token:", error);
            });
            return;
          }

          // Restore API key from sessionStorage (only after the backend verified it)
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
              credits: userData.credits ?? 0,
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

  return null;
}
