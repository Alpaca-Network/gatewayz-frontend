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

  try {
    console.log("[SessionInit] Fetching user data from backend");
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout for user fetch

    const userResponse = await fetch("/api/user/me", {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (userResponse.ok) {
      const userData = await userResponse.json() as UserData;
      console.log("[SessionInit] User data fetched successfully:", {
        user_id: userData.user_id,
        credits: userData.credits,
        tier: userData.tier,
      });

      // Cache the result for fast re-access
      setCachedUserData(token, userData);
      return userData;
    } else {
      console.error("[SessionInit] Failed to fetch user data:", userResponse.status);
      return null;
    }
  } catch (error) {
    console.error("[SessionInit] Error fetching user data:", error);
    // Return null on timeout or network error - context will handle it
    return null;
  }
}

export function SessionInitializer() {
  const router = useRouter();
  const { status, refresh, login, privyReady } = useGatewayzAuth();
  const initializedRef = useRef(false);

  useEffect(() => {
    // Skip if already initialized to prevent double execution
    if (initializedRef.current) return;

    // Only proceed if Privy is ready and we have an action to process
    // Don't mark as initialized if waiting for Privy, so we'll retry when Privy is ready
    try {
      const { action } = getSessionTransferParams();
      if (action && !privyReady) {
        console.log("[SessionInit] Privy not ready yet, waiting for Privy to initialize before processing action");
        return; // Don't mark initializedRef.current as true - wait for Privy
      }
    } catch (e) {
      // If we can't get session params, just continue with initialization
      // Errors during actual initialization will be caught below
      console.error("[SessionInit] Error checking session transfer params:", e);
    }

    // Mark as initialized BEFORE async operations to prevent duplicate initialization
    initializedRef.current = true;

    async function initializeSession() {
      // Check for URL params from session transfer
      const { token, userId, returnUrl, action: currentAction } = getSessionTransferParams();

      console.log("[SessionInit] Session initialization started", {
        hasToken: !!token,
        hasUserId: !!userId,
        action: currentAction,
        status,
        privyReady
      });

      if (token && userId) {
        console.log("[SessionInit] Session transfer params detected", { action: currentAction });

        // Store token for persistence
        storeSessionTransferToken(token, userId);

        // Save API key to localStorage immediately
        saveApiKey(token);

        // Clean up URL immediately to prevent browser history pollution
        cleanupSessionTransferParams();

        // Fetch user data in background (non-blocking)
        fetchUserDataOptimized(token).then((userData) => {
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
          // Always trigger refresh, whether user data was fetched or not
          refresh({ force: true }).catch((error) => {
            console.error("[SessionInit] Error refreshing auth after user data fetch:", error);
          });
        }).catch((error) => {
          console.error("[SessionInit] Unexpected error during session init:", error);
          // Still trigger refresh even if something unexpected happens
          refresh({ force: true }).catch((err) => {
            console.error("[SessionInit] Error refreshing auth after error:", err);
          });
        });

        // Redirect to return URL if provided (immediate, don't wait for user fetch)
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

        // Restore API key from sessionStorage
        saveApiKey(storedToken);

        // Fetch user data in background
        fetchUserDataOptimized(storedToken).then((userData) => {
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
          // Always trigger refresh after user data fetch attempt
          refresh({ force: true }).catch((error) => {
            console.error("[SessionInit] Error refreshing auth after stored token fetch:", error);
          });
        }).catch((error) => {
          console.error("[SessionInit] Error fetching user data from stored token:", error);
          // Still trigger refresh on error
          refresh({ force: true }).catch((err) => {
            console.error("[SessionInit] Error refreshing auth after stored token error:", err);
          });
        });

        return;
      }

      // Check for action parameter (from main domain redirects: signin, freetrial)
      if (status === "unauthenticated") {
        if (currentAction) {
          console.log(
            "[SessionInit] Action parameter detected, opening Privy popup",
            { action: currentAction, status, privyReady }
          );
          cleanupSessionTransferParams();
          try {
            await login();
            console.log("[SessionInit] Login triggered successfully for action:", currentAction);
          } catch (error) {
            console.error("[SessionInit] Failed to trigger login for action:", currentAction, error);
          }
          return;
        }
      }

      // If already authenticated, continue normally
      if (status === "authenticated") {
        console.log("[SessionInit] Already authenticated");
        return;
      }
    }

    initializeSession().catch((error) => {
      console.error("[SessionInit] Error initializing session:", error);
    });
  }, [refresh, router, status, login, privyReady]);

  return null;
}
