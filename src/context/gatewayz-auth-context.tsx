"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  AUTH_REFRESH_EVENT,
  getApiKey,
  getUserData,
  processAuthResponse,
  removeApiKey,
  saveApiKey,
  saveUserData,
  type AuthResponse,
  type UserData,
} from "@/lib/api";
import { usePrivy, type User, type LinkedAccountWithMetadata } from "@privy-io/react-auth";
import {
  redirectToBetaWithSession,
  getSessionTransferParams,
  cleanupSessionTransferParams,
  storeSessionTransferToken,
  getStoredSessionTransferToken,
} from "@/integrations/privy/auth-session-transfer";

type AuthStatus = "idle" | "unauthenticated" | "authenticating" | "authenticated" | "error";

type AuthError = {
  status?: number;
  message?: string;
  raw?: unknown;
};

interface GatewayzAuthContextValue {
  status: AuthStatus;
  apiKey: string | null;
  userData: UserData | null;
  privyUser: User | null;
  privyReady: boolean;
  privyAuthenticated: boolean;
  error: string | null;
  login: () => Promise<void> | void;
  logout: () => Promise<void> | void;
  refresh: (options?: { force?: boolean }) => Promise<void>;
  redirectToBeta?: (returnUrl?: string) => void;
}

interface GatewayzAuthProviderProps {
  children: ReactNode;
  onAuthError?: (error: AuthError) => void;
  enableBetaRedirect?: boolean;
  betaDomain?: string;
}

export const GatewayzAuthContext = createContext<GatewayzAuthContextValue | undefined>(undefined);
const TEMP_API_KEY_PREFIX = "gw_temp_";

const stripUndefined = <T,>(value: T): T => {
  if (Array.isArray(value)) {
    return value.map(stripUndefined) as unknown as T;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => [k, stripUndefined(v)]);
    return Object.fromEntries(entries) as unknown as T;
  }

  return value;
};

const toUnixSeconds = (value: unknown): number | undefined => {
  if (!value) return undefined;

  if (typeof value === "number") {
    return Math.floor(value);
  }

  if (value instanceof Date) {
    return Math.floor(value.getTime() / 1000);
  }

  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
      return Math.floor(parsed / 1000);
    }
    const numeric = Number(value);
    if (!Number.isNaN(numeric)) {
      return Math.floor(numeric);
    }
  }

  return undefined;
};

const mapLinkedAccount = (account: LinkedAccountWithMetadata) => {
  // Skip wallet accounts as the backend only expects email/oauth accounts in linked_accounts
  if (account.type === "wallet") {
    return null;
  }

  const get = (key: string) =>
    Object.prototype.hasOwnProperty.call(account, key)
      ? (account as unknown as Record<string, unknown>)[key]
      : undefined;

  return stripUndefined({
    type: account.type as string | undefined,
    subject: get("subject") as string | undefined,
    email: get("email") as string | undefined,
    name: get("name") as string | undefined,
    chain_type: get("chainType") as string | undefined,
    wallet_client_type: get("walletClientType") as string | undefined,
    connector_type: get("connectorType") as string | undefined,
    verified_at: toUnixSeconds(get("verifiedAt")),
    first_verified_at: toUnixSeconds(get("firstVerifiedAt")),
    latest_verified_at: toUnixSeconds(get("latestVerifiedAt")),
  });
};

export function GatewayzAuthProvider({
  children,
  onAuthError,
  enableBetaRedirect = false,
  betaDomain = 'https://beta.gatewayz.ai',
}: GatewayzAuthProviderProps) {
  const {
    ready: privyReady,
    authenticated,
    user,
    login: privyLogin,
    logout: privyLogout,
    getAccessToken,
  } = usePrivy();

  const [status, setStatus] = useState<AuthStatus>(() => {
    if (typeof window === "undefined") {
      return "idle";
    }
    // Fast path: check if we already have valid cached credentials
    const storedKey = getApiKey();
    const storedUser = getUserData();
    if (storedKey && storedUser) {
      // Validate basic structure without expensive operations
      if (storedUser.user_id && storedUser.api_key && storedUser.email) {
        return "authenticated";
      }
    }
    return "idle";
  });
  const [apiKey, setApiKey] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return getApiKey();
  });
  const [userData, setUserData] = useState<UserData | null>(() => {
    if (typeof window === "undefined") return null;
    return getUserData();
  });
  const [error, setError] = useState<string | null>(null);

  const syncInFlightRef = useRef(false);
  const syncPromiseRef = useRef<Promise<void> | null>(null);
  const lastSyncedPrivyIdRef = useRef<string | null>(null);
  const upgradeAttemptedRef = useRef(false);
  const upgradePromiseRef = useRef<Promise<void> | null>(null);
  const betaRedirectAttemptedRef = useRef(false);

  const updateStateFromStorage = useCallback(() => {
    const key = getApiKey();
    const stored = getUserData();
    setApiKey(key);
    setUserData(stored);
    if (key && stored) {
      setStatus("authenticated");
    }
  }, []);

  const clearStoredCredentials = useCallback(() => {
    removeApiKey();
    setApiKey(null);
    setUserData(null);
    lastSyncedPrivyIdRef.current = null;
    upgradeAttemptedRef.current = false;
  }, []);

  const upgradeApiKeyIfNeeded = useCallback(
    async (authData: AuthResponse) => {
      const currentKey = getApiKey();
      if (!currentKey || !currentKey.startsWith(TEMP_API_KEY_PREFIX)) {
        return;
      }

      try {
        const credits = Math.floor(authData.credits ?? 0);
        // Skip upgrade if insufficient credits or new user
        if (credits <= 10 || authData.is_new_user) {
          return;
        }

        // Return existing upgrade promise if already in progress
        if (upgradePromiseRef.current) {
          console.log("[Auth] Upgrade already in progress, returning existing promise");
          return upgradePromiseRef.current;
        }

        // Atomic check-and-set for upgrade attempt
        if (upgradeAttemptedRef.current) {
          return;
        }

        upgradeAttemptedRef.current = true;

        // Create and store the upgrade promise
        const upgradePromise = (async () => {
          try {
            // Use timeout for API key fetch to prevent hanging
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

            const response = await fetch("/api/user/api-keys", {
              method: "GET",
              headers: {
                Authorization: `Bearer ${currentKey}`,
                "Content-Type": "application/json",
              },
              signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
              console.log("[Auth] Unable to fetch upgraded API keys:", response.status);
              return;
            }

            const data = await response.json();
            const keys: Array<{ api_key?: string; is_primary?: boolean; environment_tag?: string }> =
              Array.isArray(data?.keys) ? data.keys : [];

        // Find preferred key with better short-circuit logic
        let preferredKey: { api_key?: string; is_primary?: boolean; environment_tag?: string } | undefined;

        for (const key of keys) {
          if (
            typeof key.api_key === "string" &&
            !key.api_key.startsWith(TEMP_API_KEY_PREFIX)
          ) {
            // Primary preference: live environment + primary key
            if (key.environment_tag === "live" && key.is_primary) {
              preferredKey = key;
              break;
            }
            // Secondary preference: live environment (any key)
            if (key.environment_tag === "live" && !preferredKey) {
              preferredKey = key;
            }
            // Fallback: any non-temp key
            if (!preferredKey) {
              preferredKey = key;
            }
          }
        }

        if (!preferredKey || !preferredKey.api_key) {
          console.log("[Auth] No upgraded API key found in response");
          return;
        }

        if (preferredKey.api_key === currentKey) {
          return;
        }

        console.log("[Auth] Upgrading stored API key to live key");
        saveApiKey(preferredKey.api_key);

        const storedUser = getUserData();
        if (storedUser) {
          saveUserData({
            ...storedUser,
            api_key: preferredKey.api_key,
            tier: authData.tier,
            tier_display_name: authData.tier_display_name,
            subscription_status: authData.subscription_status,
            subscription_end_date: authData.subscription_end_date,
          });
        } else {
          saveUserData({
            user_id: authData.user_id,
            api_key: preferredKey.api_key,
            auth_method: authData.auth_method,
            privy_user_id: authData.privy_user_id,
            display_name: authData.display_name,
            email: authData.email,
            credits: Math.floor(authData.credits ?? 0),
            tier: authData.tier,
            tier_display_name: authData.tier_display_name,
            subscription_status: authData.subscription_status,
            subscription_end_date: authData.subscription_end_date,
          });
        }

            updateStateFromStorage();
          } catch (error) {
            console.log("[Auth] Failed to upgrade API key after payment", error);
            upgradeAttemptedRef.current = false;
            throw error;
          } finally {
            // Clear the promise reference when done
            upgradePromiseRef.current = null;
          }
        })();

        upgradePromiseRef.current = upgradePromise;
        await upgradePromise;
      } catch (error) {
        console.log("[Auth] Failed to upgrade API key after payment", error);
        upgradeAttemptedRef.current = false;
        upgradePromiseRef.current = null;
      }
    },
    [updateStateFromStorage]
  );

  const redirectToBetaIfEnabled = useCallback(
    (returnUrl?: string) => {
      if (!enableBetaRedirect || !apiKey || !userData) {
        return;
      }

      if (betaRedirectAttemptedRef.current) {
        return;
      }

      betaRedirectAttemptedRef.current = true;
      console.log("[Auth] Redirecting to beta domain with session");

      // Store token in sessionStorage before redirect
      storeSessionTransferToken(apiKey, userData.user_id);

      // Redirect to beta domain
      redirectToBetaWithSession(apiKey, userData.user_id, betaDomain, returnUrl);
    },
    [enableBetaRedirect, apiKey, userData, betaDomain]
  );

  const handleAuthSuccess = useCallback(
    (authData: AuthResponse, isNewUserExpected: boolean) => {
      console.log("[Auth] Processing auth success with data:", {
        credits: authData.credits,
        is_new_user: authData.is_new_user,
        user_id: authData.user_id
      });

      processAuthResponse(authData);
      updateStateFromStorage();
      lastSyncedPrivyIdRef.current = authData.privy_user_id || null;
      setStatus("authenticated");

      // Clear referral code if present
      const referralCode = localStorage.getItem("gatewayz_referral_code");
      if (referralCode) {
        localStorage.removeItem("gatewayz_referral_code");
        if (authData.is_new_user ?? isNewUserExpected) {
          localStorage.setItem("gatewayz_show_referral_bonus", "true");
        }
        console.log("Referral code cleared from localStorage after successful auth");
      }

      // Verify localStorage was written before redirecting
      const savedUserData = getUserData();
      console.log("[Auth] Verified saved user data before redirect:", savedUserData);

      if (authData.is_new_user ?? isNewUserExpected) {
        console.log("[Auth] New user detected");

        // If beta redirect is enabled, redirect there instead of onboarding
        if (enableBetaRedirect) {
          console.log("[Auth] Redirecting new user to beta domain");
          redirectToBetaIfEnabled("/onboarding");
        } else {
          console.log("[Auth] Redirecting new user to onboarding");
          // Redirect immediately - localStorage writes are synchronous
          window.location.href = "/onboarding";
        }
      }
    },
    [updateStateFromStorage, enableBetaRedirect, redirectToBetaIfEnabled]
  );

  const handleAuthSuccessAsync = useCallback(
    async (authData: AuthResponse, isNewUserExpected: boolean) => {
      handleAuthSuccess(authData, isNewUserExpected);
      // Fire and forget the API key upgrade - don't await it
      // This prevents blocking login completion on a secondary operation
      upgradeApiKeyIfNeeded(authData).catch((error) => {
        console.log("[Auth] Background API key upgrade failed (non-blocking):", error);
      });
    },
    [handleAuthSuccess, upgradeApiKeyIfNeeded]
  );

  const buildAuthRequestBody = useCallback(
    (privyUser: User, token: string | null, existingUserData: UserData | null) => {
      const existingGatewayzUser = existingUserData ?? null;
      const isNewUser = !existingGatewayzUser;
      const hasStoredApiKey = Boolean(existingGatewayzUser?.api_key);

      // Check for referral code from storage or URL
      let referralCode = localStorage.getItem("gatewayz_referral_code");
      if (!referralCode && typeof window !== "undefined") {
        const urlParams = new URLSearchParams(window.location.search);
        const urlRefCode = urlParams.get("ref");
        if (urlRefCode) {
          referralCode = urlRefCode;
          localStorage.setItem("gatewayz_referral_code", urlRefCode);
          console.log("[Auth] Captured referral code from URL:", urlRefCode);
        }
      }

      console.log("[Auth] Final referral code:", referralCode);

      const authRequestBody = {
        user: stripUndefined({
          id: privyUser.id,
          created_at: toUnixSeconds(privyUser.createdAt) ?? Math.floor(Date.now() / 1000),
          linked_accounts: (privyUser.linkedAccounts || []).map(mapLinkedAccount).filter(Boolean),
          mfa_methods: privyUser.mfaMethods || [],
          has_accepted_terms: privyUser.hasAcceptedTerms ?? false,
          is_guest: privyUser.isGuest ?? false,
        }),
        token: token ?? "",
        auto_create_api_key: isNewUser || !hasStoredApiKey,
        is_new_user: isNewUser,
        has_referral_code: !!referralCode,
        referral_code: referralCode ?? null,
        privy_user_id: privyUser.id,
      };

      if (isNewUser) {
        return {
          ...authRequestBody,
          trial_credits: 10,
        };
      }

      return authRequestBody;
    },
    []
  );

  const syncWithBackend = useCallback(
    async (options?: { force?: boolean }) => {
      if (!privyReady) {
        return;
      }

      if (!authenticated || !user) {
        clearStoredCredentials();
        setStatus(privyReady ? "unauthenticated" : "idle");
        syncPromiseRef.current = null;
        return;
      }

      // Skip if we've already synced with this Privy user and have valid credentials
      if (!options?.force && lastSyncedPrivyIdRef.current === user.id && apiKey) {
        console.log("[Auth] Already synced with this Privy user, skipping sync");
        setStatus("authenticated");
        return;
      }

      // Return existing sync promise if already in progress
      if (syncPromiseRef.current && !options?.force) {
        console.log("[Auth] Sync already in flight, returning existing promise");
        return syncPromiseRef.current;
      }

      // Create new sync promise
      const syncPromise = (async () => {
        // Atomic check-and-set
        const wasInFlight = syncInFlightRef.current;
        syncInFlightRef.current = true;

        if (wasInFlight && !options?.force) {
          console.log("[Auth] Sync already in flight (race detected), skipping");
          return;
        }

        setStatus("authenticating");
        setError(null);

      try {
        // Get token with timeout to prevent hanging
        const tokenPromise = getAccessToken();
        let token: string | null = null;

        try {
          // Add a reasonable timeout (3 seconds) for token retrieval
          token = await Promise.race([
            tokenPromise,
            new Promise<null>((_, reject) =>
              setTimeout(() => reject(new Error("Token retrieval timeout")), 3000)
            )
          ]);
        } catch (tokenErr) {
          console.warn("[Auth] Failed to get token:", tokenErr);
          token = null; // Continue without token, let backend decide
        }

        console.log("[Auth] Token retrieved:", token ? `${token.substring(0, 20)}...` : "null");

        const authBody = buildAuthRequestBody(user, token, userData);
        console.log("[Auth] Sending auth body to backend:", {
          has_privy_user_id: !!authBody.privy_user_id,
          has_token: !!authBody.token,
          is_new_user: authBody.is_new_user,
          auto_create_api_key: authBody.auto_create_api_key,
        });

        // Use fetch with timeout for backend call
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        const response = await fetch("/api/auth", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(authBody),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        const rawResponseText = await response.text();

        if (!response.ok) {
          console.error("[Auth] Backend auth failed with status", response.status);
          console.error("[Auth] Response text:", rawResponseText.substring(0, 500));
          clearStoredCredentials();
          setStatus("error");
          const authError: AuthError = { status: response.status, message: rawResponseText };
          setError(authError.message ?? `Authentication failed: ${response.status}`);
          onAuthError?.(authError);
          return;
        }

        let authData: AuthResponse;
        try {
          authData = JSON.parse(rawResponseText) as AuthResponse;
        } catch (parseError) {
          console.error("[Auth] Failed to parse auth response JSON");
          console.error("[Auth] Parse error:", parseError instanceof Error ? parseError.message : String(parseError));
          console.error("[Auth] Response was:", rawResponseText.substring(0, 500));
          clearStoredCredentials();
          setStatus("error");
          setError("Authentication failed: Invalid response format");
          onAuthError?.({ raw: parseError });
          return;
        }

        if (!authData.api_key) {
          const fallbackApiKey =
            (authData as unknown as { data?: { api_key?: string } })?.data?.api_key ??
            (authData as unknown as { apiKey?: string }).apiKey ??
            null;

          if (fallbackApiKey) {
            console.log("[Auth] Found API key in alternative field, using it");
            authData = { ...authData, api_key: fallbackApiKey };
          } else {
            console.error("[Auth] Backend auth response missing api_key field");
            console.error("[Auth] Response data was:", JSON.stringify(authData, null, 2).substring(0, 500));
            clearStoredCredentials();
            setStatus("error");
            setError("Authentication failed: No API key in response");
            onAuthError?.({ message: "Missing API key in auth response" });
            return;
          }
        }

        console.log("[Auth] Backend authentication successful:", authData);
        await handleAuthSuccessAsync(
          authData,
          (authBody as { is_new_user?: boolean }).is_new_user ?? false
        );
        } catch (err) {
          console.error("[Auth] Error during backend sync:", err);

          // Check if this is a non-blocking wallet extension error
          const errorMsg = err instanceof Error ? err.message : String(err);
          const isWalletExtensionError = errorMsg.includes("chrome.runtime.sendMessage") ||
                                        errorMsg.includes("runtime.sendMessage") ||
                                        errorMsg.includes("Extension ID") ||
                                        errorMsg.includes("from a webpage");

          // If it's just a wallet extension error, don't treat it as auth failure
          // The user can still authenticate with other methods (email, Google, GitHub)
          if (isWalletExtensionError) {
            console.warn("[Auth] Wallet extension error (non-blocking), ignoring and maintaining current auth state");
            // Don't change status or clear credentials - just ignore the wallet error
            // The authentication may have already succeeded before the wallet error occurred
            // If user has valid cached credentials, keep them authenticated
            const storedKey = getApiKey();
            const storedUser = getUserData();
            if (storedKey && storedUser && storedUser.user_id && storedUser.email) {
              console.log("[Auth] Valid credentials found despite wallet error - keeping authenticated");
              setStatus("authenticated");
            }
            // Otherwise, don't set error status - keep current status
            return;
          }

          clearStoredCredentials();
          setStatus("error");
          setError(err instanceof Error ? err.message : "Authentication failed");
          onAuthError?.({ raw: err });
        } finally {
          syncInFlightRef.current = false;
          syncPromiseRef.current = null;
        }
      })();

      syncPromiseRef.current = syncPromise;
      return syncPromise;
    },
    [
      apiKey,
      authenticated,
      buildAuthRequestBody,
      clearStoredCredentials,
      getAccessToken,
      handleAuthSuccessAsync,
      onAuthError,
      privyReady,
      user,
      userData,
    ]
  );

  useEffect(() => {
    if (!privyReady) {
      setStatus("idle");
      return;
    }

    // If Privy user is authenticated, always sync with backend
    if (authenticated && user) {
      syncWithBackend();
      return;
    }

    // If Privy session is not authenticated, but we have cached credentials,
    // keep them - don't clear. The user may have a valid gatewayz session
    // even if their Privy session expired.
    if (!authenticated || !user) {
      const storedKey = getApiKey();
      const storedUser = getUserData();

      // If we have valid cached credentials, stay authenticated
      if (storedKey && storedUser && storedUser.user_id && storedUser.email) {
        console.log("[Auth] Privy not authenticated but cached credentials found - maintaining session");
        setStatus("authenticated");
      } else {
        // Only clear if we truly have no session
        clearStoredCredentials();
        setStatus("unauthenticated");
      }
      return;
    }
  }, [authenticated, clearStoredCredentials, privyReady, syncWithBackend, user]);

  useEffect(() => {
    const handler = () => {
      console.log("[Auth] Received refresh event");
      syncWithBackend({ force: true }).catch((err) => {
        console.error("[Auth] Error refreshing auth:", err);
      });
    };

    if (typeof window !== "undefined") {
      window.addEventListener(AUTH_REFRESH_EVENT, handler);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener(AUTH_REFRESH_EVENT, handler);
      }
    };
  }, [syncWithBackend]);

  // Memoize login/logout to avoid inline function recreation
  const login = useCallback(async () => {
    // Let Privy handle its own login flow - don't intercept errors here
    // Wallet errors during Privy's flow are handled by Privy itself
    // Wallet errors during backend sync are handled in syncWithBackend()
    await privyLogin();
  }, [privyLogin]);
  const logout = useCallback(async () => {
    clearStoredCredentials();
    await privyLogout();
    setStatus("unauthenticated");
  }, [clearStoredCredentials, privyLogout]);

  const contextValue = useMemo<GatewayzAuthContextValue>(
    () => ({
      status,
      apiKey,
      userData,
      privyUser: user ?? null,
      privyReady,
      privyAuthenticated: authenticated,
      error,
      login,
      logout,
      refresh: (options) => syncWithBackend(options),
      redirectToBeta: enableBetaRedirect ? redirectToBetaIfEnabled : undefined,
    }),
    [
      apiKey,
      authenticated,
      enableBetaRedirect,
      error,
      login,
      logout,
      privyReady,
      redirectToBetaIfEnabled,
      status,
      syncWithBackend,
      user,
      userData,
    ]
  );

  return <GatewayzAuthContext.Provider value={contextValue}>{children}</GatewayzAuthContext.Provider>;
}

export function useGatewayzAuth(): GatewayzAuthContextValue {
  const ctx = useContext(GatewayzAuthContext);
  if (!ctx) {
    throw new Error("useGatewayzAuth must be used within a GatewayzAuthProvider");
  }
  return ctx;
}
