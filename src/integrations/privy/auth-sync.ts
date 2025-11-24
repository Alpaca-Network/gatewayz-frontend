/**
 * Authentication Sync Module
 *
 * Handles synchronization between Privy authentication and Gatewayz backend
 * Returns necessary tokens and user data for session transfer
 */

import type { User } from '@privy-io/react-auth';
import type { AuthResponse, UserData } from '@/lib/api';

/**
 * Syncs Privy authentication with Gatewayz backend
 * This function already exists in the auth context but is extracted here for reusability
 * and to support session transfer scenarios
 *
 * @param privyUser - Privy user object from usePrivy()
 * @param privyAccessToken - Access token from Privy's getAccessToken()
 * @param existingUserData - Existing user data if user was previously authenticated
 * @returns Promise with authentication response and Privy token for session transfer
 */

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
    // Assume numbers are in milliseconds (from .getTime()) and convert to seconds
    // If the number is already in seconds (less than 10000000000), return as-is
    const seconds = value > 10000000000 ? Math.floor(value / 1000) : Math.floor(value);
    return seconds;
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
      // Same logic: if > 10000000000, assume milliseconds
      return numeric > 10000000000 ? Math.floor(numeric / 1000) : Math.floor(numeric);
    }
  }

  return undefined;
};

export async function syncPrivyToGatewayz(
  privyUser: User,
  privyAccessToken: string | null,
  existingUserData: UserData | null
): Promise<{
  authResponse: AuthResponse;
  privyAccessToken: string | null;
}> {
  if (!privyUser) {
    throw new Error('Privy user is required for sync');
  }

  const isNewUser = !existingUserData;
  const hasStoredApiKey = Boolean(existingUserData?.api_key);

  // Check for referral code from storage or URL
  let referralCode = null;
  if (typeof window !== 'undefined') {
    referralCode = localStorage.getItem('gatewayz_referral_code');
    if (!referralCode) {
      const urlParams = new URLSearchParams(window.location.search);
      const urlRefCode = urlParams.get('ref');
      if (urlRefCode) {
        referralCode = urlRefCode;
        localStorage.setItem('gatewayz_referral_code', urlRefCode);
        console.log('[AuthSync] Captured referral code from URL:', urlRefCode);
      }
    }
  }

  // Build auth request body (matches the one in gatewayz-auth-context.tsx)
  const authRequestBody = {
    user: stripUndefined({
      id: privyUser.id,
      created_at: toUnixSeconds(privyUser.createdAt) ?? Math.floor(Date.now() / 1000),
      linked_accounts: (privyUser.linkedAccounts || [])
        .filter((account: any) => account.type !== 'wallet') // Only include email/oauth accounts
        .map((account: any) => {
          // Normalize account type: Privy returns 'github_oauth' but backend expects 'github'
          let normalizedType = account.type as string | undefined;
          if (normalizedType === 'github_oauth') {
            normalizedType = 'github';
          }
          return stripUndefined({
            type: normalizedType,
          subject: Object.prototype.hasOwnProperty.call(account, 'subject')
            ? (account as unknown as Record<string, unknown>)['subject']
            : undefined,
          email: Object.prototype.hasOwnProperty.call(account, 'email')
            ? (account as unknown as Record<string, unknown>)['email']
            : undefined,
          name: Object.prototype.hasOwnProperty.call(account, 'name')
            ? (account as unknown as Record<string, unknown>)['name']
            : undefined,
          chain_type: Object.prototype.hasOwnProperty.call(account, 'chainType')
            ? (account as unknown as Record<string, unknown>)['chainType']
            : undefined,
          wallet_client_type: Object.prototype.hasOwnProperty.call(account, 'walletClientType')
            ? (account as unknown as Record<string, unknown>)['walletClientType']
            : undefined,
          connector_type: Object.prototype.hasOwnProperty.call(account, 'connectorType')
            ? (account as unknown as Record<string, unknown>)['connectorType']
            : undefined,
          verified_at: toUnixSeconds(Object.prototype.hasOwnProperty.call(account, 'verifiedAt')
            ? (account as unknown as Record<string, unknown>)['verifiedAt']
            : undefined),
          first_verified_at: toUnixSeconds(Object.prototype.hasOwnProperty.call(account, 'firstVerifiedAt')
            ? (account as unknown as Record<string, unknown>)['firstVerifiedAt']
            : undefined),
          latest_verified_at: toUnixSeconds(Object.prototype.hasOwnProperty.call(account, 'latestVerifiedAt')
            ? (account as unknown as Record<string, unknown>)['latestVerifiedAt']
            : undefined),
          });
        })
        .filter(Boolean),
      mfa_methods: privyUser.mfaMethods || [],
      has_accepted_terms: privyUser.hasAcceptedTerms ?? false,
      is_guest: privyUser.isGuest ?? false,
    }),
    token: privyAccessToken ?? '',
    auto_create_api_key: isNewUser || !hasStoredApiKey,
    is_new_user: isNewUser,
    has_referral_code: !!referralCode,
    referral_code: referralCode ?? null,
    privy_user_id: privyUser.id,
  };

  if (isNewUser) {
    (authRequestBody as any).trial_credits = 10;
  }

  console.log('[AuthSync] Syncing with Gatewayz backend:', {
    privy_user_id: privyUser.id,
    is_new_user: isNewUser,
  });

  try {
    const response = await fetch('/api/auth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(authRequestBody),
    });

    const rawResponseText = await response.text();

    if (!response.ok) {
      console.error('[AuthSync] Backend auth failed:', response.status, rawResponseText);
      throw new Error(`Backend authentication failed: ${response.status}`);
    }

    let authResponse: AuthResponse;
    try {
      authResponse = JSON.parse(rawResponseText) as AuthResponse;
    } catch (parseError) {
      console.error('[AuthSync] Failed to parse auth response:', parseError);
      throw new Error('Failed to parse authentication response');
    }

    // Handle missing API key
    if (!authResponse.api_key) {
      const fallbackApiKey =
        (authResponse as any)?.data?.api_key ??
        (authResponse as any)?.apiKey ??
        null;

      if (fallbackApiKey) {
        authResponse = { ...authResponse, api_key: fallbackApiKey };
      } else {
        throw new Error('Backend authentication response missing API key');
      }
    }

    console.log('[AuthSync] Backend authentication successful');

    return {
      authResponse,
      privyAccessToken,
    };
  } catch (error) {
    console.error('[AuthSync] Error during sync:', error);
    throw error;
  }
}
