"use client";

/**
 * Gatewayz Auth Context v2
 *
 * A simplified auth context that uses the new auth module:
 * - Uses AuthMachine for state management
 * - Uses AuthService for backend communication
 * - Integrates with Privy for login/logout
 * - Backward compatible API with v1
 *
 * To migrate:
 * 1. Import from this file instead of gatewayz-auth-context.tsx
 * 2. Or set NEXT_PUBLIC_NEW_AUTH=true to use this version
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as Sentry from "@sentry/nextjs";
import { usePrivy, type User } from "@privy-io/react-auth";

// Import from new auth module
import {
  AuthMachine,
  AuthService,
  authService,
  getApiKey,
  getUserData,
  clearAuthData,
  AUTH_EVENTS,
  AUTH_TIMEOUTS,
  type AuthState,
  type AuthenticatedUser,
  type AuthMethod,
  type StoredUserData,
} from "@/lib/auth";

// Legacy imports for backward compatibility
import {
  redirectToBetaWithSession,
  storeSessionTransferToken,
} from "@/integrations/privy/auth-session-transfer";
import { navigateTo } from "@/lib/utils";

// =============================================================================
// TYPES (backward compatible with v1)
// =============================================================================

type AuthStatus = "idle" | "unauthenticated" | "authenticating" | "authenticated" | "error";

// Map new auth states to legacy status
function toAuthStatus(state: AuthState): AuthStatus {
  switch (state) {
    case "idle":
      return "idle";
    case "unauthenticated":
      return "unauthenticated";
    case "authenticating":
    case "syncing":
    case "refreshing":
      return "authenticating";
    case "authenticated":
      return "authenticated";
    case "error":
      return "error";
    default:
      return "idle";
  }
}

// Legacy UserData type (for backward compatibility)
interface UserData {
  user_id: number;
  api_key: string;
  auth_method: string;
  privy_user_id: string;
  display_name: string;
  email: string;
  credits: number;
  tier?: string;
  tier_display_name?: string;
  subscription_status?: string;
  subscription_end_date?: number;
}

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
  onAuthError?: (error: { status?: number; message?: string; raw?: unknown }) => void;
  enableBetaRedirect?: boolean;
  betaDomain?: string;
}

// =============================================================================
// CONTEXT
// =============================================================================

export const GatewayzAuthContext = createContext<GatewayzAuthContextValue | undefined>(undefined);

// =============================================================================
// PROVIDER
// =============================================================================

export function GatewayzAuthProvider({
  children,
  onAuthError,
  enableBetaRedirect = false,
  betaDomain = "https://beta.gatewayz.ai",
}: GatewayzAuthProviderProps) {
  // Privy integration
  const {
    ready: privyReady,
    authenticated: privyAuthenticated,
    user: privyUser,
    login: privyLogin,
    logout: privyLogout,
    getAccessToken,
  } = usePrivy();

  // Auth state machine
  const machineRef = useRef<AuthMachine | null>(null);
  const [authState, setAuthState] = useState<AuthState>("idle");
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Refs to prevent concurrent operations
  const syncInProgressRef = useRef(false);
  const lastSyncedPrivyIdRef = useRef<string | null>(null);
  const betaRedirectAttemptedRef = useRef(false);

  // Initialize auth machine
  useEffect(() => {
    if (machineRef.current) return;

    machineRef.current = new AuthMachine({
      onStateChange: (state, context) => {
        setAuthState(state);
        setUser(context.user);
        setErrorMessage(context.error?.message ?? null);

        // Set Sentry user context
        if (context.user) {
          Sentry.setUser({
            id: String(context.user.userId),
            email: context.user.email,
          });
        } else if (state === "unauthenticated") {
          Sentry.setUser(null);
        }
      },
      onAuthenticated: (authUser) => {
        console.log("[AuthV2] User authenticated:", authUser.email);

        Sentry.addBreadcrumb({
          category: "auth",
          message: "User authenticated",
          level: "info",
          data: {
            user_id: authUser.userId,
            tier: authUser.tier,
          },
        });
      },
      onLogout: () => {
        console.log("[AuthV2] User logged out");
        lastSyncedPrivyIdRef.current = null;
      },
      onError: (error) => {
        console.error("[AuthV2] Auth error:", error);

        Sentry.captureException(new Error(error.message), {
          tags: { auth_error: error.code },
          level: "error",
        });

        onAuthError?.({ message: error.message });
      },
    });

    // Try to restore session from localStorage
    const restoreSession = async () => {
      const restoredUser = await authService.restoreSession();
      if (restoredUser) {
        machineRef.current?.send({ type: "SESSION_RESTORED", user: restoredUser });
      } else {
        machineRef.current?.send({ type: "SESSION_INVALID" });
      }
    };

    restoreSession();
  }, [onAuthError]);

  // ===========================================================================
  // SYNC WITH BACKEND
  // ===========================================================================

  const syncWithBackend = useCallback(
    async (options?: { force?: boolean }) => {
      const machine = machineRef.current;
      if (!machine) return;

      // Wait for Privy to be ready
      if (!privyReady) {
        console.log("[AuthV2] Waiting for Privy to be ready...");
        return;
      }

      // If Privy user is not authenticated, handle logout
      if (!privyAuthenticated || !privyUser) {
        if (machine.isAuthenticated) {
          // Keep existing session if we have one
          console.log("[AuthV2] Privy not authenticated, but keeping existing session");
        } else {
          machine.send({ type: "SESSION_INVALID" });
        }
        return;
      }

      // Skip if already synced with this Privy user (unless forced)
      if (!options?.force && lastSyncedPrivyIdRef.current === privyUser.id && machine.isAuthenticated) {
        console.log("[AuthV2] Already synced with this Privy user");
        return;
      }

      // Prevent concurrent syncs
      if (syncInProgressRef.current && !options?.force) {
        console.log("[AuthV2] Sync already in progress");
        return;
      }

      syncInProgressRef.current = true;

      try {
        // Determine auth method
        const authMethod = determineAuthMethod(privyUser);

        // Start authentication
        machine.send({ type: "LOGIN_START", method: authMethod });

        // Get Privy access token
        let token: string | null = null;
        try {
          token = await Promise.race([
            getAccessToken(),
            new Promise<null>((_, reject) =>
              setTimeout(() => reject(new Error("Token timeout")), AUTH_TIMEOUTS.TOKEN_RETRIEVAL)
            ),
          ]);
        } catch (err) {
          console.warn("[AuthV2] Failed to get token:", err);
          // Continue without token - backend will decide
        }

        // Signal Privy success
        machine.send({ type: "PRIVY_SUCCESS", privyUserId: privyUser.id, token });

        // Sync with backend - transform Privy types to expected format
        const result = await authService.syncWithBackend(
          privyUser.id,
          token,
          {
            email: privyUser.email ? { address: privyUser.email.address } : null,
            wallet: privyUser.wallet ? { address: privyUser.wallet.address } : null,
            google: privyUser.google ? { email: privyUser.google.email } : null,
            github: privyUser.github?.username ? { username: privyUser.github.username } : null,
            linkedAccounts: privyUser.linkedAccounts?.map((account) => {
              const { type, ...rest } = account;
              return { type, ...rest };
            }),
          },
          authMethod
        );

        if (result.ok) {
          machine.send({ type: "SYNC_SUCCESS", user: result.value });
          lastSyncedPrivyIdRef.current = privyUser.id;

          // Handle new user onboarding
          if (result.value.isNewUser) {
            if (enableBetaRedirect) {
              handleBetaRedirect("/onboarding");
            } else {
              navigateTo("/onboarding");
            }
          }
        } else {
          machine.send({ type: "SYNC_ERROR", error: result.error });
        }
      } catch (err) {
        const error = {
          code: "UNKNOWN" as const,
          message: err instanceof Error ? err.message : "Unknown error",
          timestamp: Date.now(),
        };
        machine.send({ type: "SYNC_ERROR", error });
      } finally {
        syncInProgressRef.current = false;
      }
    },
    [privyReady, privyAuthenticated, privyUser, getAccessToken, enableBetaRedirect]
  );

  // Auto-sync when Privy auth changes
  useEffect(() => {
    if (privyReady) {
      syncWithBackend();
    }
  }, [privyReady, privyAuthenticated, privyUser?.id, syncWithBackend]);

  // Listen for refresh events
  useEffect(() => {
    const handleRefresh = () => {
      console.log("[AuthV2] Received refresh event");
      syncWithBackend({ force: true });
    };

    window.addEventListener(AUTH_EVENTS.REFRESH_REQUEST, handleRefresh);
    return () => window.removeEventListener(AUTH_EVENTS.REFRESH_REQUEST, handleRefresh);
  }, [syncWithBackend]);

  // ===========================================================================
  // ACTIONS
  // ===========================================================================

  const login = useCallback(async () => {
    await privyLogin();
  }, [privyLogin]);

  const logout = useCallback(async () => {
    const machine = machineRef.current;
    if (machine) {
      machine.send({ type: "LOGOUT" });
    }
    clearAuthData();
    await privyLogout();
  }, [privyLogout]);

  const refresh = useCallback(
    async (options?: { force?: boolean }) => {
      await syncWithBackend(options);
    },
    [syncWithBackend]
  );

  const handleBetaRedirect = useCallback(
    (returnUrl?: string) => {
      if (!enableBetaRedirect || !user) return;
      if (betaRedirectAttemptedRef.current) return;

      betaRedirectAttemptedRef.current = true;
      storeSessionTransferToken(user.apiKey, user.userId);
      redirectToBetaWithSession(user.apiKey, user.userId, betaDomain, returnUrl);
    },
    [enableBetaRedirect, user, betaDomain]
  );

  // ===========================================================================
  // COMPUTED VALUES (backward compatible)
  // ===========================================================================

  const status = toAuthStatus(authState);
  const apiKey = user?.apiKey ?? null;

  // Convert to legacy UserData format
  const userData: UserData | null = user
    ? {
        user_id: user.userId,
        api_key: user.apiKey,
        auth_method: user.authMethod,
        privy_user_id: user.privyUserId,
        display_name: user.displayName,
        email: user.email,
        credits: user.credits,
        tier: user.tier,
        tier_display_name: user.tierDisplayName,
        subscription_status: user.subscriptionStatus,
        subscription_end_date: user.subscriptionEndDate,
      }
    : null;

  // ===========================================================================
  // CONTEXT VALUE
  // ===========================================================================

  const contextValue = useMemo<GatewayzAuthContextValue>(
    () => ({
      status,
      apiKey,
      userData,
      privyUser: privyUser ?? null,
      privyReady,
      privyAuthenticated,
      error: errorMessage,
      login,
      logout,
      refresh,
      redirectToBeta: enableBetaRedirect ? handleBetaRedirect : undefined,
    }),
    [
      status,
      apiKey,
      userData,
      privyUser,
      privyReady,
      privyAuthenticated,
      errorMessage,
      login,
      logout,
      refresh,
      enableBetaRedirect,
      handleBetaRedirect,
    ]
  );

  return (
    <GatewayzAuthContext.Provider value={contextValue}>
      {children}
    </GatewayzAuthContext.Provider>
  );
}

// =============================================================================
// HOOK
// =============================================================================

export function useGatewayzAuth(): GatewayzAuthContextValue {
  const ctx = useContext(GatewayzAuthContext);
  if (!ctx) {
    throw new Error("useGatewayzAuth must be used within a GatewayzAuthProvider");
  }
  return ctx;
}

// =============================================================================
// HELPERS
// =============================================================================

function determineAuthMethod(privyUser: User): AuthMethod {
  if (privyUser.google) return "google";
  if (privyUser.github) return "github";
  if (privyUser.wallet) return "wallet";
  return "email";
}
