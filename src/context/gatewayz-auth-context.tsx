"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import * as Sentry from "@sentry/nextjs";
import {
  AUTH_REFRESH_EVENT,
  AUTH_REFRESH_COMPLETE_EVENT,
  getApiKey,
  getUserData,
  processAuthResponse,
  removeApiKey,
  saveApiKey,
  saveUserData,
  type AuthResponse,
  type UserData,
} from "@/lib/api";
import { getAdaptiveTimeout } from "@/lib/network-timeouts";
import { retryFetch } from "@/lib/retry-utils";
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

// Auth state machine for clear state transitions
const AUTH_STATE_TRANSITIONS: Record<AuthStatus, AuthStatus[]> = {
  idle: ["unauthenticated", "authenticating", "authenticated"],
  unauthenticated: ["authenticating", "authenticated"],
  authenticating: ["authenticated", "unauthenticated", "error"],
  authenticated: ["authenticating", "unauthenticated", "error"],
  error: ["unauthenticated", "authenticating"],
};

// Auth retry configuration
const MAX_AUTH_RETRIES = 3;
const AUTHENTICATING_TIMEOUT_MS = 30000; // 30 seconds
const TOKEN_TIMEOUT_BASE_MS = 5000; // Base 5 seconds, adaptive up to 10s

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

const BACKEND_PROXY_TIMEOUT_MS = 15000;
const BACKEND_PROXY_MAX_RETRIES = 3;
const BACKEND_PROXY_SAFETY_BUFFER_MS = 5000;
const MIN_AUTH_SYNC_TIMEOUT_MS =
  BACKEND_PROXY_TIMEOUT_MS * BACKEND_PROXY_MAX_RETRIES + BACKEND_PROXY_SAFETY_BUFFER_MS;

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

  // Normalize account type: Privy returns 'github_oauth' but backend expects 'github'
  let normalizedType = account.type as string | undefined;
  if (normalizedType === "github_oauth") {
    normalizedType = "github";
  }

  return stripUndefined({
    type: normalizedType,
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
  const authRetryCountRef = useRef(0);
  const authTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Helper function to validate and set auth status with state machine
  const setAuthStatus = useCallback((newStatus: AuthStatus, reason?: string) => {
    setStatus((currentStatus) => {
      const allowedTransitions = AUTH_STATE_TRANSITIONS[currentStatus];

      if (!allowedTransitions.includes(newStatus)) {
        console.warn(
          `[Auth] Invalid state transition: ${currentStatus} -> ${newStatus}${reason ? ` (${reason})` : ""}. Skipping.`
        );
        return currentStatus; // Don't change status
      }

      console.log(
        `[Auth] State transition: ${currentStatus} -> ${newStatus}${reason ? ` (${reason})` : ""}`
      );
      return newStatus;
    });
  }, []);

  // Clear authenticating timeout guard
  const clearAuthTimeout = useCallback(() => {
    if (authTimeoutRef.current) {
      clearTimeout(authTimeoutRef.current);
      authTimeoutRef.current = null;
    }
  }, []);

  // Set authenticating timeout guard
  const setAuthTimeout = useCallback(() => {
    clearAuthTimeout();
    authTimeoutRef.current = setTimeout(() => {
      console.error("[Auth] Authentication timeout - stuck in authenticating state for 30s");
      setAuthStatus("error", "timeout");
      setError("Authentication timeout - please try again");

      Sentry.captureMessage("Authentication timeout - stuck in authenticating state", {
        level: 'error',
        tags: {
          auth_error: 'authenticating_timeout',
        },
      });
    }, AUTHENTICATING_TIMEOUT_MS);
  }, [clearAuthTimeout, setAuthStatus]);

  const updateStateFromStorage = useCallback(() => {
    const key = getApiKey();
    const stored = getUserData();
    setApiKey(key);
    setUserData(stored);
    if (key && stored) {
      setAuthStatus("authenticated", "from storage");
    }
  }, [setAuthStatus]);

  const clearStoredCredentials = useCallback(() => {
    removeApiKey();
    setApiKey(null);
    setUserData(null);
    lastSyncedPrivyIdRef.current = null;
    upgradeAttemptedRef.current = false;
    authRetryCountRef.current = 0;
    clearAuthTimeout();
  }, [clearAuthTimeout]);

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
              console.error("[Auth] Unable to fetch upgraded API keys:", response.status);
              console.error("[Auth] This is a critical issue - temp keys cannot be upgraded!");
              console.error("[Auth] User will be unable to use chat completions with temp key");

              // If we can't upgrade and have a temp key, this is a critical auth failure
              throw new Error(`Failed to upgrade temporary API key: ${response.status}. Temp keys have limited permissions.`);
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

      // Add breadcrumb for successful authentication
      Sentry.addBreadcrumb({
        category: 'auth',
        message: 'User authenticated successfully',
        level: 'info',
        data: {
          user_id: authData.user_id,
          is_new_user: authData.is_new_user,
          tier: authData.tier,
        },
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
      // Check if we need to attempt a key upgrade
      // New users start with trial credits and don't need immediate upgrade
      // Users with low credits (<= 10) likely only have the temp key anyway
      const shouldCheckUpgrade = !authData.is_new_user && (authData.credits ?? 0) > 10;

      let finalAuthData = authData;

      if (shouldCheckUpgrade) {
        // Save initial credentials so upgrade logic can access them from storage
        processAuthResponse(authData);

        try {
          // Await the upgrade to ensure we have the correct key before resolving auth
          // This prevents race conditions where UI tries to use temp key
          await upgradeApiKeyIfNeeded(authData);

          // If key was upgraded, update authData so handleAuthSuccess uses the new key
          const currentKey = getApiKey();
          if (currentKey && currentKey !== authData.api_key) {
            console.log("[Auth] API key upgraded during login, using new key");
            finalAuthData = { ...authData, api_key: currentKey };
          } else if (currentKey?.startsWith(TEMP_API_KEY_PREFIX)) {
            // Still have temp key after upgrade attempt - this is critical
            console.error("[Auth] Still using temporary API key after upgrade attempt!");
            console.error("[Auth] This will cause 401 errors on protected endpoints");

            // Clear the invalid credentials
            clearStoredCredentials();

            // Set error state
            setAuthStatus("error", "temp key upgrade failed");
            setError("Authentication failed: Unable to obtain valid API key. Please try logging in again.");

            // Capture to Sentry
            Sentry.captureMessage("Temporary API key could not be upgraded after authentication", {
              level: 'error',
              tags: {
                auth_error: 'temp_key_upgrade_failed',
              },
              extra: {
                credits: authData.credits,
                is_new_user: authData.is_new_user,
                has_temp_key: true,
              },
            });

            return; // Don't proceed with authentication
          }
        } catch (error) {
          console.error("[Auth] Key upgrade check failed:", error);

          // If upgrade failed and we have a temp key, this is critical
          const currentKey = getApiKey();
          if (currentKey?.startsWith(TEMP_API_KEY_PREFIX)) {
            clearStoredCredentials();
            setAuthStatus("error", "temp key upgrade error");
            setError("Authentication failed: Unable to obtain valid API key. Please try logging in again.");

            Sentry.captureException(
              error instanceof Error ? error : new Error(String(error)),
              {
                tags: {
                  auth_error: 'temp_key_upgrade_exception',
                },
                extra: {
                  credits: authData.credits,
                  is_new_user: authData.is_new_user,
                },
                level: 'error',
              }
            );

            return; // Don't proceed with authentication
          }

          // If not a temp key issue, just warn and continue
          console.warn("[Auth] Key upgrade check failed but proceeding with current key");
        }
      }

      handleAuthSuccess(finalAuthData, isNewUserExpected);
    },
    [handleAuthSuccess, upgradeApiKeyIfNeeded, clearStoredCredentials, setAuthStatus, setError]
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
        // Only request API key creation for new users or users without stored keys
        // Existing users should get their existing key back to avoid replacing live keys with temp keys
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
        setAuthStatus(privyReady ? "unauthenticated" : "idle", "no privy user");
        syncPromiseRef.current = null;
        return;
      }

      // Check retry limit
      if (authRetryCountRef.current >= MAX_AUTH_RETRIES && !options?.force) {
        console.error("[Auth] Max retry limit reached, aborting sync");
        setAuthStatus("error", "max retries");
        setError(`Authentication failed after ${MAX_AUTH_RETRIES} attempts. Please try again later.`);

        Sentry.captureMessage("Authentication max retry limit reached", {
          level: 'error',
          tags: {
            auth_error: 'max_retries_exceeded',
          },
          extra: {
            retry_count: authRetryCountRef.current,
          },
        });
        return;
      }

      // Skip if we've already synced with this Privy user and have valid credentials
      if (!options?.force && lastSyncedPrivyIdRef.current === user.id && apiKey) {
        console.log("[Auth] Already synced with this Privy user, skipping sync");
        setAuthStatus("authenticated", "already synced");
        return;
      }

      // Return existing sync promise if already in progress
      if (syncPromiseRef.current && !options?.force) {
        console.log("[Auth] Sync already in flight, returning existing promise");
        return syncPromiseRef.current;
      }

      // Reset retry count on forced refresh
      if (options?.force) {
        authRetryCountRef.current = 0;
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

        // Increment retry count
        authRetryCountRef.current += 1;
        console.log(`[Auth] Sync attempt ${authRetryCountRef.current}/${MAX_AUTH_RETRIES}`);

        setAuthStatus("authenticating", `attempt ${authRetryCountRef.current}`);
        setError(null);

        // Set timeout guard for stuck authenticating state
        setAuthTimeout();

        // Add breadcrumb for auth sync start
        Sentry.addBreadcrumb({
          category: 'auth',
          message: 'Starting backend authentication sync',
          level: 'debug',
          data: {
            force: options?.force ?? false,
            retry_attempt: authRetryCountRef.current,
          },
        });

      try {
        // Ensure Privy is actually ready before attempting token retrieval
        if (!privyReady || !authenticated || !user) {
          console.warn("[Auth] Privy state invalid for token retrieval - aborting sync attempt");
          console.warn("[Auth] State: privyReady=", privyReady, "authenticated=", authenticated, "user=", !!user);

          Sentry.captureMessage("Invalid Privy state during token retrieval attempt", {
            level: 'warning',
            tags: {
              auth_error: 'invalid_privy_state_for_token',
            },
            extra: {
              privy_ready: privyReady,
              privy_authenticated: authenticated,
              has_user: !!user,
            },
          });

          syncInFlightRef.current = false;
          syncPromiseRef.current = null;
          setAuthStatus("unauthenticated", "privy state invalid");
          return;
        }

        // Get token with adaptive timeout to prevent hanging
        const tokenPromise = getAccessToken();
        let token: string | null = null;

        try {
          // Adaptive timeout: 5-10 seconds based on network conditions
          const tokenTimeoutMs = getAdaptiveTimeout(TOKEN_TIMEOUT_BASE_MS, {
            maxMs: 10000, // Up to 10 seconds
            mobileMultiplier: 1.8,
            slowNetworkMultiplier: 2,
          });

          console.log(`[Auth] Attempting token retrieval with ${tokenTimeoutMs}ms timeout`);

          token = await Promise.race([
            tokenPromise,
            new Promise<null>((_, reject) =>
              setTimeout(() => reject(new Error("Token retrieval timeout")), tokenTimeoutMs)
            )
          ]);

          if (!token) {
            console.warn("[Auth] Token retrieval returned null/empty token");
          }
        } catch (tokenErr) {
          console.warn("[Auth] Failed to get token:", tokenErr);

          // Capture token retrieval error to Sentry (but as warning since we can continue)
          const tokenErrMsg = tokenErr instanceof Error ? tokenErr.message : String(tokenErr);
          if (tokenErrMsg.includes("timeout")) {
            console.warn("[Auth] Token timeout - proceeding with null token");
            Sentry.captureMessage("Token retrieval timeout during authentication", {
              level: 'warning',
              tags: {
                auth_error: 'token_timeout',
              },
            });
          } else {
            console.warn("[Auth] Token retrieval error:", tokenErrMsg);
            Sentry.captureException(
              tokenErr instanceof Error ? tokenErr : new Error(String(tokenErr)),
              {
                tags: {
                  auth_error: 'token_retrieval_failed',
                },
                level: 'warning',
              }
            );
          }

          token = null; // Continue without token, let backend decide
        }

        console.log("[Auth] Token retrieved:", token ? `${token.substring(0, 20)}...` : "null");

        // Preserve existing live key before auth refresh
        // If backend returns a temp key, we'll restore this
        const existingLiveKey = userData?.api_key && !userData.api_key.startsWith(TEMP_API_KEY_PREFIX)
          ? userData.api_key
          : null;

        if (existingLiveKey) {
          console.log("[Auth] Preserving existing live key for potential restore");
        }

        const authBody = buildAuthRequestBody(user, token, userData);
        console.log("[Auth] Sending auth body to backend:", {
          has_privy_user_id: !!authBody.privy_user_id,
          has_token: !!authBody.token,
          is_new_user: authBody.is_new_user,
          auto_create_api_key: authBody.auto_create_api_key,
          });

        // Use fetch with timeout for backend call (minimum aligned with proxy retries)
        const controller = new AbortController();
        const baseTimeout = 10000;
        const adaptiveTimeout = getAdaptiveTimeout(baseTimeout, {
          maxMs: 25000,
          mobileMultiplier: 2.2,
          slowNetworkMultiplier: 3,
        });
        const timeoutMs = Math.max(adaptiveTimeout, MIN_AUTH_SYNC_TIMEOUT_MS);
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs); // Network-aware timeout

        let response: Response;
        try {
          response = await retryFetch(
            () =>
              fetch("/api/auth", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(authBody),
                signal: controller.signal,
              }),
            {
              maxRetries: 2,
              initialDelayMs: 300,
              maxDelayMs: 3000,
              backoffMultiplier: 2,
              retryableStatuses: [502, 503, 504],
            }
          );
        } finally {
          clearTimeout(timeoutId);
        }

        const rawResponseText = await response.text();

        if (!response.ok) {
          console.error("[Auth] Backend auth failed with status", response.status);
          console.error("[Auth] Response text:", rawResponseText.substring(0, 500));
          clearStoredCredentials();
          setAuthStatus("error", `backend status ${response.status}`);
          const authError: AuthError = { status: response.status, message: rawResponseText };
          setError(authError.message ?? `Authentication failed: ${response.status}`);

          // Capture auth failure to Sentry
          Sentry.captureException(
            new Error(`Authentication failed: ${response.status}`),
            {
              tags: {
                auth_error: 'backend_auth_failed',
                http_status: response.status,
              },
              extra: {
                response_status: response.status,
                response_text: rawResponseText.substring(0, 500),
                auth_method: (authBody as { auth_method?: string }).auth_method,
                retry_attempt: authRetryCountRef.current,
              },
              level: 'error',
            }
          );

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
          setAuthStatus("error", "parse error");
          setError("Authentication failed: Invalid response format");

          // Capture JSON parse error to Sentry
          Sentry.captureException(
            parseError instanceof Error ? parseError : new Error(String(parseError)),
            {
              tags: {
                auth_error: 'response_parse_failed',
              },
              extra: {
                response_text: rawResponseText.substring(0, 500),
                response_length: rawResponseText.length,
                retry_attempt: authRetryCountRef.current,
              },
              level: 'error',
            }
          );

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
            setAuthStatus("error", "missing api key");
            setError("Authentication failed: No API key in response");

            // Capture missing API key error to Sentry
            Sentry.captureException(
              new Error("Authentication failed: No API key in response"),
              {
                tags: {
                  auth_error: 'missing_api_key',
                },
                extra: {
                  response_data: JSON.stringify(authData, null, 2).substring(0, 500),
                  response_keys: Object.keys(authData).join(', '),
                  retry_attempt: authRetryCountRef.current,
                },
                level: 'error',
              }
            );

            onAuthError?.({ message: "Missing API key in auth response" });
            return;
          }
        }

        console.log("[Auth] Backend authentication successful:", authData);

        // Check if we got a temporary API key
        if (authData.api_key?.startsWith(TEMP_API_KEY_PREFIX)) {
          console.warn("[Auth] Received temporary API key, will need to upgrade");

          // CRITICAL FIX: If we had a live key before and backend returned a temp key,
          // restore the live key instead of using the temp key
          if (existingLiveKey) {
            console.log("[Auth] Backend returned temp key but we have existing live key - restoring live key");
            authData = { ...authData, api_key: existingLiveKey };
          }
        } else {
          console.log("[Auth] Received permanent API key");
        }

        // Clear timeout guard and reset retry count on success
        clearAuthTimeout();
        authRetryCountRef.current = 0;

        await handleAuthSuccessAsync(
          authData,
          (authBody as { is_new_user?: boolean }).is_new_user ?? false
        );
        } catch (err) {
          console.error("[Auth] Error during backend sync:", err);

          const isAbortError =
            err instanceof DOMException && err.name === "AbortError";

          if (isAbortError) {
            console.warn(
              "[Auth] Backend sync aborted after exceeding timeout (frontend safeguard)"
            );
            setStatus("error");
            setError("Authentication request timed out. Please try again.");

            Sentry.captureMessage("Authentication sync aborted by client timeout", {
              level: "warning",
              tags: {
                auth_error: "frontend_timeout",
              },
            });

            onAuthError?.({ message: "Authentication request timed out", raw: err });
            return;
          }

          // Check if this is a non-blocking wallet extension error
          const errorMsg = err instanceof Error ? err.message : String(err);
          const isWalletExtensionError = errorMsg.includes("chrome.runtime.sendMessage") ||
                                        errorMsg.includes("runtime.sendMessage") ||
                                        errorMsg.includes("Extension ID") ||
                                        errorMsg.includes("from a webpage");

          // If it's just a wallet extension error, don't treat it as auth failure
          // The user can still authenticate with other methods (email, Google, GitHub)
          if (isWalletExtensionError) {
            console.warn("[Auth] Wallet extension error (non-blocking), maintaining current auth state");

            // Log wallet error to Sentry but as a warning (non-blocking)
            Sentry.captureMessage(`Wallet extension error during auth: ${errorMsg}`, {
              level: 'warning',
              tags: {
                auth_error: 'wallet_extension_error',
                blocking: 'false',
              },
            });

            // Don't change status or clear credentials - just ignore the wallet error
            // The authentication may have already succeeded before the wallet error occurred
            // If user has valid cached credentials, keep them authenticated
            const storedKey = getApiKey();
            const storedUser = getUserData();
            if (storedKey && storedUser && storedUser.user_id && storedUser.email) {
              console.log("[Auth] Valid credentials found despite wallet error - keeping authenticated");
              setAuthStatus("authenticated", "wallet error non-blocking");
              clearAuthTimeout(); // Clear timeout if we're staying authenticated
              authRetryCountRef.current = 0; // Reset retry count
            } else {
              // Show user-friendly error if we can't maintain auth
              setError("Wallet extension error - please sign in with email or social login");
            }
            return;
          }

          clearStoredCredentials();
          setAuthStatus("error", "backend sync exception");
          setError(err instanceof Error ? err.message : "Authentication failed");

          // Capture authentication error to Sentry
          Sentry.captureException(
            err instanceof Error ? err : new Error(String(err)),
            {
              tags: {
                auth_error: 'backend_sync_error',
              },
              extra: {
                error_message: errorMsg,
                retry_attempt: authRetryCountRef.current,
              },
              level: 'error',
            }
          );

          onAuthError?.({ raw: err });
        } finally {
          syncInFlightRef.current = false;
          syncPromiseRef.current = null;
          // Note: Don't clear timeout here - it's cleared on success or kept on error

          // Signal that auth refresh is complete (success or failure)
          // This allows requestAuthRefresh() promise to resolve/reject
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event(AUTH_REFRESH_COMPLETE_EVENT));
          }
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
    // Only proceed with sync when Privy is ready
    if (!privyReady) {
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
        setAuthStatus("authenticated", "cached credentials");
      } else {
        // Only clear if we truly have no session
        clearStoredCredentials();
        setAuthStatus("unauthenticated", "no privy or cached session");
      }
      return;
    }
  }, [authenticated, clearStoredCredentials, privyReady, setAuthStatus, syncWithBackend, user]);

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
    setAuthStatus("unauthenticated", "logout");
  }, [clearStoredCredentials, privyLogout, setAuthStatus]);

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
