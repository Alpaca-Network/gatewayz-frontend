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
import { saveApiKey } from "@/lib/api";

export function SessionInitializer() {
  const router = useRouter();
  const { status, refresh, login } = useGatewayzAuth();

  useEffect(() => {
    async function initializeSession() {
      // Check for URL params from session transfer
      const { token, userId, returnUrl } = getSessionTransferParams();

      if (token && userId) {
        console.log("[SessionInit] Session transfer params detected");

        // Store token for persistence
        storeSessionTransferToken(token, userId);

        // Save API key to localStorage
        saveApiKey(token);

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

        // Trigger auth refresh
        await refresh({ force: true });

        return;
      }

      // Check for auth trigger parameter (from main domain "Sign In" button)
      if (status === "unauthenticated") {
        const params = new URLSearchParams(
          typeof window !== "undefined" ? window.location.search : ""
        );
        const shouldTriggerAuth = params.get("auth") === "true";

        if (shouldTriggerAuth) {
          console.log(
            "[SessionInit] Auth trigger detected, opening Privy popup"
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
