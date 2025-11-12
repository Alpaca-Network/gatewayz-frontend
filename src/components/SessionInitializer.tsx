"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useGatewayzAuth } from "@/context/gatewayz-auth-context";
import {
  getSessionTransferParams,
  cleanupSessionTransferParams,
  storeSessionTransferToken,
  getStoredSessionTransferToken,
} from "@/integrations/privy/auth-session-transfer";
import { saveApiKey, saveUserData, type UserData } from "@/lib/api";

export function SessionInitializer() {
  const router = useRouter();
  const { status, refresh, login } = useGatewayzAuth();

  useEffect(() => {
    async function initializeSession() {
      // Check for URL params from session transfer
      const { token, userId, returnUrl, action } = getSessionTransferParams();

      if (token && userId) {
        console.log("[SessionInit] Session transfer params detected", { action });

        // Store token for persistence
        storeSessionTransferToken(token, userId);

        // Save API key to localStorage
        saveApiKey(token);

        // Fetch user data using the API key
        try {
          console.log("[SessionInit] Fetching user data from backend");
          const userResponse = await fetch("/api/user/me", {
            headers: {
              "Authorization": `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          });

          if (userResponse.ok) {
            const userData = await userResponse.json();
            console.log("[SessionInit] User data fetched successfully:", {
              user_id: userData.user_id,
              credits: userData.credits,
            });

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
            console.log("[SessionInit] User data saved to localStorage");
          } else {
            console.error("[SessionInit] Failed to fetch user data:", userResponse.status);
          }
        } catch (error) {
          console.error("[SessionInit] Error fetching user data:", error);
        }

        // Clean up URL to remove transfer params
        cleanupSessionTransferParams();

        // Trigger auth refresh to sync with context
        await refresh({ force: true });

        // Redirect to return URL if provided, otherwise stay on current page
        if (returnUrl) {
          setTimeout(() => {
            router.push(returnUrl);
          }, 100);
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

        // Fetch user data using the API key
        try {
          console.log("[SessionInit] Fetching user data from backend (stored token)");
          const userResponse = await fetch("/api/user/me", {
            headers: {
              "Authorization": `Bearer ${storedToken}`,
              "Content-Type": "application/json",
            },
          });

          if (userResponse.ok) {
            const userData = await userResponse.json();
            console.log("[SessionInit] User data fetched successfully (stored token):", {
              user_id: userData.user_id,
              credits: userData.credits,
            });

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
            console.log("[SessionInit] User data saved to localStorage (stored token)");
          } else {
            console.error("[SessionInit] Failed to fetch user data (stored token):", userResponse.status);
          }
        } catch (error) {
          console.error("[SessionInit] Error fetching user data (stored token):", error);
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
