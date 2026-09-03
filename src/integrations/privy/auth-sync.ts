/**
 * Authentication Sync Module
 *
 * Handles synchronization between Privy authentication and Gatewayz backend
 * Returns necessary tokens and user data for session transfer
 */

import * as Sentry from '@sentry/nextjs';
import type { User } from '@privy-io/react-auth';
import type { AuthResponse, UserData } from '@/lib/api';
import { buildAuthRequestBody, getPrivyAccessTokenWithRetry } from '@/lib/auth/build-auth-request';

/**
 * Syncs Privy authentication with Gatewayz backend
 * This function already exists in the auth context but is extracted here for reusability
 * and to support session transfer scenarios
 *
 * @param privyUser - Privy user object from usePrivy()
 * @param getAccessToken - Privy's `getAccessToken()` (from usePrivy()). Called with up to 3
 *   retries (250/500/1000ms backoff, see getPrivyAccessTokenWithRetry) — if it still resolves
 *   null, this throws rather than syncing without a token (the backend now requires it, W0).
 * @param existingUserData - Existing user data if user was previously authenticated
 * @returns Promise with authentication response and Privy token for session transfer
 */
export async function syncPrivyToGatewayz(
  privyUser: User,
  getAccessToken: () => Promise<string | null>,
  existingUserData: UserData | null
): Promise<{
  authResponse: AuthResponse;
  privyAccessToken: string | null;
}> {
  if (!privyUser) {
    throw new Error('Privy user is required for sync');
  }

  const privyAccessToken = await getPrivyAccessTokenWithRetry(getAccessToken);

  if (!privyAccessToken) {
    console.error('[AuthSync] Could not obtain a Privy access token after retries - aborting sync');
    Sentry.captureMessage('Privy access token unavailable after retries', {
      level: 'error',
      tags: {
        auth_error: 'privy_token_unavailable',
      },
    });
    throw new Error('Could not verify your session — please retry');
  }

  const authRequestBody = buildAuthRequestBody(privyUser, {
    token: privyAccessToken,
    existingUserData,
  });

  console.log('[AuthSync] Syncing with Gatewayz backend:', {
    privy_user_id: privyUser.id,
    is_new_user: authRequestBody.is_new_user,
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
