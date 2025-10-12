"use client";

import { PrivyProvider, usePrivy, type User, type LinkedAccountWithMetadata } from '@privy-io/react-auth';
import { base } from 'viem/chains';
import { ReactNode, useState, useEffect } from 'react';
import { API_BASE_URL } from '@/lib/config';
import { RateLimitHandler } from '@/components/auth/rate-limit-handler';

interface PrivyProviderWrapperProps {
  children: ReactNode;
}

const stripUndefined = <T,>(value: T): T => {
  if (Array.isArray(value)) {
    return value.map(stripUndefined) as unknown as T;
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => [k, stripUndefined(v)]);
    return Object.fromEntries(entries) as unknown as T;
  }

  return value;
};

const toUnixSeconds = (value: unknown): number | undefined => {
  if (!value) return undefined;

  if (typeof value === 'number') {
    return Math.floor(value);
  }

  if (value instanceof Date) {
    return Math.floor(value.getTime() / 1000);
  }

  if (typeof value === 'string') {
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
    subject: get('subject') as string | undefined,
    email: get('email') as string | undefined,
    name: get('name') as string | undefined,
    address: get('address') as string | undefined,
    chain_type: get('chainType') as string | undefined,
    wallet_client_type: get('walletClientType') as string | undefined,
    connector_type: get('connectorType') as string | undefined,
    verified_at: toUnixSeconds(get('verifiedAt')),
    first_verified_at: toUnixSeconds(get('firstVerifiedAt')),
    latest_verified_at: toUnixSeconds(get('latestVerifiedAt')),
  });
};

export function PrivyProviderWrapper({ children }: PrivyProviderWrapperProps) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const [showRateLimit, setShowRateLimit] = useState(false);

  if (!appId) {
    throw new Error('NEXT_PUBLIC_PRIVY_APP_ID is not set');
  }

  const handleLoginSuccess = async (user: User) => {
    console.log('Login successful:', { user });

    const existingGatewayzUser = localStorage.getItem('gatewayz_user_data');
    const isNewUser = !existingGatewayzUser;

    try {
      // Get the Privy access token
      const token = localStorage.getItem('privy:token');

      // Check for referral code from localStorage (set by signup page)
      const referralCode = localStorage.getItem('gatewayz_referral_code');
      console.log('Referral code from localStorage:', referralCode);

      // Authenticate with backend
      const authBody = stripUndefined({
        user: stripUndefined({
          id: user.id,
          created_at: toUnixSeconds(user.createdAt) ?? Math.floor(Date.now() / 1000),
          linked_accounts: (user.linkedAccounts || []).map(mapLinkedAccount),
          mfa_methods: user.mfaMethods || [],
          has_accepted_terms: user.hasAcceptedTerms ?? false,
          is_guest: user.isGuest ?? false,
        }),
        token,
        auto_create_api_key: true,
        trial_credits: 10,
        is_new_user: isNewUser,
        referral_code: referralCode || undefined,
      });

      const authResponse = await fetch(`${API_BASE_URL}/auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(authBody),
      });

      if (!authResponse.ok) {
        console.error('Backend auth failed:', await authResponse.text());
        return;
      }

      const authData = await authResponse.json();
      console.log('Backend authentication successful:', authData);

      // Store API key if provided
      if (authData.api_key) {
        localStorage.setItem('gatewayz_api_key', authData.api_key);
      }

      // Store user data
      if (authData.user_id) {
        // Extract real email from Privy user object
        let userEmail = authData.email || null;

        // If auth data doesn't have email or has a Privy DID, try to extract from linked accounts
        if (!userEmail || userEmail.startsWith('did:privy:')) {
          for (const account of user.linkedAccounts || []) {
            if (account.type === 'email' && (account as { email?: string }).email) {
              userEmail = (account as { email?: string }).email!;
              break;
            } else if (account.type === 'google_oauth' && (account as { email?: string }).email) {
              userEmail = (account as { email?: string }).email!;
              break;
            }
          }
        }

        localStorage.setItem('gatewayz_user_data', JSON.stringify({
          user_id: authData.user_id,
          display_name: authData.display_name || userEmail || 'User',
          email: userEmail,
          api_key: authData.api_key,
          auth_method: authData.auth_method || 'privy',
          privy_user_id: user.id,
          credits: authData.credits || 0,
        }));
      }

      // Clear referral code after successful authentication
      // Also set a flag to show bonus credits notification
      if (referralCode) {
        localStorage.removeItem('gatewayz_referral_code');
        // Set flag to show referral bonus notification on chat page
        if (authData.is_new_user ?? isNewUser) {
          localStorage.setItem('gatewayz_show_referral_bonus', 'true');
        }
        console.log('Referral code cleared from localStorage after successful auth');
      }

      // Redirect new users to onboarding
      if (authData.is_new_user ?? isNewUser) {
        window.location.href = '/onboarding';
      }
    } catch (error) {
      console.error('Error during login:', error);
      handleLoginError(error);
    }
  };

  const handleLoginError = (error: unknown) => {
    console.error('Privy login error:', error);

    const message = typeof error === 'object' && error !== null ? (error as { message?: string; status?: number }) : undefined;
    if (message?.status === 429 || message?.message?.includes('429')) {
      console.warn('Rate limit hit. Please wait before trying again.');
      setShowRateLimit(true);
    }
  };

  useEffect(() => {
    const rateLimitListener = (event: PromiseRejectionEvent) => {
      const reason = event.reason as { status?: number; message?: string } | undefined;
      if (reason?.status === 429 || reason?.message?.includes('429')) {
        console.warn('Caught 429 error globally');
        setShowRateLimit(true);
        event.preventDefault();
      }
    };

    window.addEventListener('unhandledrejection', rateLimitListener);
    return () => window.removeEventListener('unhandledrejection', rateLimitListener);
  }, []);

  return (
    <>
      <RateLimitHandler
        show={showRateLimit}
        onDismiss={() => setShowRateLimit(false)}
      />
      <PrivyProvider
        appId={appId}
        config={{
          loginMethods: ['email', 'google', 'github'],
          appearance: {
            theme: 'light',
            accentColor: '#000000',
            logo: '/logo_black.svg',
          },
          embeddedWallets: {
            ethereum: {
              createOnLogin: "users-without-wallets",
            },
          },
          defaultChain: base,
        }}
      >
        <PrivyAuthEffect onLoginSuccess={handleLoginSuccess} onLoginError={handleLoginError} />
        {children}
      </PrivyProvider>
    </>
  );
}

function PrivyAuthEffect({
  onLoginSuccess,
  onLoginError,
}: {
  onLoginSuccess: (user: User) => Promise<void>;
  onLoginError: (error: unknown) => void;
}) {
  const { ready, authenticated, user } = usePrivy();
  const [lastProcessedUser, setLastProcessedUser] = useState<string | null>(null);

  useEffect(() => {
    if (!authenticated) {
      setLastProcessedUser(null);
    }
  }, [authenticated]);

  useEffect(() => {
    if (!ready || !authenticated || !user) {
      return;
    }

    if (lastProcessedUser === user.id) {
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        await onLoginSuccess(user);
        if (!cancelled) {
          setLastProcessedUser(user.id);
        }
      } catch (error) {
        if (!cancelled) {
          onLoginError(error);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, user, lastProcessedUser, onLoginSuccess, onLoginError]);

  return null;
}

