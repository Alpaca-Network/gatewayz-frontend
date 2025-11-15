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

// Cache for user data fetches to avoid duplicate requests
const userDataCache = new Map<string, { data: UserData; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCachedUserData(token: string): UserData | null {
  const cached = userDataCache.get(token);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  return null;
}

function setCachedUserData(token: string, data: UserData): void {
  userDataCache.set(token, { data, timestamp: Date.now() });
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
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const userResponse = await fetch("/api/user/me", {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (userResponse.ok) {
      const userData = await userResponse.json();
      console.log("[SessionInit] User data fetched successfully:", {
        user_id: userData.user_id,
        credits: userData.credits,
        tier: userData.tier,
      });

      return userData;
    } else {
      console.error("[SessionInit] Failed to fetch user data:", userResponse.status);
      return null;
    }
  } catch (error) {
    console.error("[SessionInit] Error fetching user data:", error);
    return null;
  }
}

export function SessionInitializer() {
  const router = useRouter();
  const { status, refresh, login } = useGatewayzAuth();
  const initializedRef = useRef(false);

  useEffect(() => {
    // Skip if already initialized to prevent double execution
    if (initializedRef.current) return;
    initializedRef.current = true;

    async function initializeSession() {
      // Check for URL params from session transfer
      const { token, userId, returnUrl, action } = getSessionTransferParams();

      if (token && userId) {
        console.log("[SessionInit] Session transfer params detected", { action });

        // Store token for persistence
        storeSessionTransferToken(token, userId);

        // Save API key to localStorage immediately
        saveApiKey(token);

        // Fetch user data
        const userData = await fetchUserDataOptimized(token);

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

          saveUserData(userDataToSave);
          setCachedUserData(token, userDataToSave);
          console.log("[SessionInit] User data saved to localStorage");
        }

        // Clean up URL to remove transfer params
        cleanupSessionTransferParams();

        // Trigger auth refresh to sync with context
        await refresh({ force: true });

        // Redirect to return URL if provided, otherwise stay on current page
        if (returnUrl) {
          // No delay for faster navigation
          router.push(returnUrl);
        }

        return;
      }

      // Check for stored session transfer token (fallback)
      const { token: storedToken, userId: storedUserId } =
        getStoredSessionTransferToken();

      if (storedToken && storedUserId && !localStorage.getItem("gatewayz_api_key")) {
        console.log("[SessionInit] Using stored session transfer token");

        // Restore API key from sessionStorage
        saveApiKey(storedToken);

        // Fetch user data
        const userData = await fetchUserDataOptimized(storedToken);

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

          saveUserData(userDataToSave);
          setCachedUserData(storedToken, userDataToSave);
          console.log("[SessionInit] User data saved to localStorage (stored token)");
        }

        // Trigger auth refresh
        await refresh({ force: true });

        return;
      }

      // Check for action parameter (from main domain redirects: signin, freetrial)
      if (status === "unauthenticated") {
        if (action) {
          console.log(
            "[SessionInit] Action parameter detected, opening Privy popup",
            { action }
          );
          cleanupSessionTransferParams();
          await login();
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
  }, [refresh, router, status, login]);

  return null;
}
