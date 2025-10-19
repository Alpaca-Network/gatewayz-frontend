"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  AUTH_REFRESH_EVENT,
  getApiKey,
  getUserData,
  processAuthResponse,
  removeApiKey,
  type AuthResponse,
  type UserData,
} from "@/lib/api";
import { API_BASE_URL } from "@/lib/config";
import { usePrivy, type User, type LinkedAccountWithMetadata } from "@privy-io/react-auth";

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
}

const GatewayzAuthContext = createContext<GatewayzAuthContextValue | undefined>(undefined);

interface GatewayzAuthProviderProps {
  children: ReactNode;
  onAuthError?: (error: AuthError) => void;
}

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
  const get = (key: string) =>
    Object.prototype.hasOwnProperty.call(account, key)
      ? (account as unknown as Record<string, unknown>)[key]
      : undefined;

  return stripUndefined({
    type: account.type as string | undefined,
    subject: get("subject") as string | undefined,
    email: get("email") as string | undefined,
    name: get("name") as string | undefined,
    address: get("address") as string | undefined,
    chain_type: get("chainType") as string | undefined,
    wallet_client_type: get("walletClientType") as string | undefined,
    connector_type: get("connectorType") as string | undefined,
    verified_at: toUnixSeconds(get("verifiedAt")),
    first_verified_at: toUnixSeconds(get("firstVerifiedAt")),
    latest_verified_at: toUnixSeconds(get("latestVerifiedAt")),
  });
};

export function GatewayzAuthProvider({ children, onAuthError }: GatewayzAuthProviderProps) {
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
    const storedKey = getApiKey();
    const storedUser = getUserData();
    return storedKey && storedUser ? "authenticated" : "idle";
  });
  const [apiKey, setApiKey] = useState<string | null>(() => getApiKey());
  const [userData, setUserData] = useState<UserData | null>(() => getUserData());
  const [error, setError] = useState<string | null>(null);

  const syncInFlightRef = useRef(false);
  const lastSyncedPrivyIdRef = useRef<string | null>(null);

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
  }, []);

  const handleAuthSuccess = useCallback(
    (authData: AuthResponse, isNewUserExpected: boolean) => {
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

      if (authData.is_new_user ?? isNewUserExpected) {
        console.log("[Auth] New user detected, redirecting to onboarding");
        window.location.href = "/onboarding";
      }
    },
    [updateStateFromStorage]
  );

  const buildAuthRequestBody = useCallback(
    (privyUser: User, token: string | null, existingUserData: UserData | null) => {
      const existingGatewayzUser = existingUserData ?? null;
      const isNewUser = !existingGatewayzUser;

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

      return {
        user: stripUndefined({
          id: privyUser.id,
          created_at: toUnixSeconds(privyUser.createdAt) ?? Math.floor(Date.now() / 1000),
          linked_accounts: (privyUser.linkedAccounts || []).map(mapLinkedAccount),
          mfa_methods: privyUser.mfaMethods || [],
          has_accepted_terms: privyUser.hasAcceptedTerms ?? false,
          is_guest: privyUser.isGuest ?? false,
        }),
        token: token ?? "",
        auto_create_api_key: true,
        trial_credits: 10,
        is_new_user: isNewUser,
        has_referral_code: !!referralCode,
        referral_code: referralCode ?? null,
        privy_user_id: privyUser.id,
      };
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
        return;
      }

      if (syncInFlightRef.current) {
        if (!options?.force) {
          return;
        }
      }

      if (!options?.force && lastSyncedPrivyIdRef.current === user.id && apiKey) {
        setStatus("authenticated");
        return;
      }

      syncInFlightRef.current = true;
      setStatus("authenticating");
      setError(null);

      try {
        const token = await getAccessToken();
        console.log("[Auth] Token retrieved:", token ? `${token.substring(0, 20)}...` : "null");

        const authBody = buildAuthRequestBody(user, token, userData);
        console.log("Sending auth body to backend:", authBody);

        const response = await fetch(`${API_BASE_URL}/auth`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(authBody),
        });

        const rawResponseText = await response.text();

        if (!response.ok) {
          console.log("[Auth] Backend auth failed:", response.status, rawResponseText);
          clearStoredCredentials();
          setStatus("error");
          const authError: AuthError = { status: response.status, message: rawResponseText };
          setError(authError.message ?? "Authentication failed");
          onAuthError?.(authError);
          return;
        }

        let authData: AuthResponse;
        try {
          authData = JSON.parse(rawResponseText) as AuthResponse;
        } catch (parseError) {
          console.error("[Auth] Failed to parse auth response JSON:", parseError, rawResponseText);
          clearStoredCredentials();
          setStatus("error");
          setError("Authentication failed");
          onAuthError?.({ raw: parseError });
          return;
        }

        if (!authData.api_key) {
          const fallbackApiKey =
            (authData as unknown as { data?: { api_key?: string } })?.data?.api_key ??
            (authData as unknown as { apiKey?: string }).apiKey ??
            null;

          if (fallbackApiKey) {
            authData = { ...authData, api_key: fallbackApiKey };
          } else {
            console.warn("[Auth] Backend auth response missing api_key field:", authData);
            clearStoredCredentials();
            setStatus("error");
            setError("Authentication failed");
            onAuthError?.({ message: "Missing API key in auth response" });
            return;
          }
        }

        console.log("[Auth] Backend authentication successful:", authData);
        handleAuthSuccess(authData, (authBody as { is_new_user?: boolean }).is_new_user ?? false);
      } catch (err) {
        console.error("[Auth] Error during backend sync:", err);
        clearStoredCredentials();
        setStatus("error");
        setError(err instanceof Error ? err.message : "Authentication failed");
        onAuthError?.({ raw: err });
      } finally {
        syncInFlightRef.current = false;
      }
    },
    [
      apiKey,
      authenticated,
      buildAuthRequestBody,
      clearStoredCredentials,
      getAccessToken,
      handleAuthSuccess,
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

    if (!authenticated || !user) {
      clearStoredCredentials();
      setStatus("unauthenticated");
      return;
    }

    syncWithBackend();
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

  const contextValue = useMemo<GatewayzAuthContextValue>(
    () => ({
      status,
      apiKey,
      userData,
      privyUser: user ?? null,
      privyReady,
      privyAuthenticated: authenticated,
      error,
      login: () => privyLogin(),
      logout: async () => {
        clearStoredCredentials();
        await privyLogout();
        setStatus("unauthenticated");
      },
      refresh: (options) => syncWithBackend(options),
    }),
    [
      apiKey,
      authenticated,
      clearStoredCredentials,
      error,
      privyLogin,
      privyLogout,
      privyReady,
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
