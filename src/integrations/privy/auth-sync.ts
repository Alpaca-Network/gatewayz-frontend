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
    user: {
      id: privyUser.id,
      created_at: privyUser.createdAt
        ? Math.floor(new Date(privyUser.createdAt).getTime() / 1000)
        : Math.floor(Date.now() / 1000),
      linked_accounts: (privyUser.linkedAccounts || []).map((account: any) => ({
        type: account.type,
        subject: account.subject,
        email: account.email,
        name: account.name,
        address: account.address,
        chain_type: account.chainType,
        wallet_client_type: account.walletClientType,
        connector_type: account.connectorType,
        verified_at: account.verifiedAt
          ? Math.floor(new Date(account.verifiedAt).getTime() / 1000)
          : undefined,
        first_verified_at: account.firstVerifiedAt
          ? Math.floor(new Date(account.firstVerifiedAt).getTime() / 1000)
          : undefined,
        latest_verified_at: account.latestVerifiedAt
          ? Math.floor(new Date(account.latestVerifiedAt).getTime() / 1000)
          : undefined,
      })),
      mfa_methods: privyUser.mfaMethods || [],
      has_accepted_terms: privyUser.hasAcceptedTerms ?? false,
      is_guest: privyUser.isGuest ?? false,
    },
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
