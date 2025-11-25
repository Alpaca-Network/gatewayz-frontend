// API utility functions for authenticated requests

const API_KEY_STORAGE_KEY = 'gatewayz_api_key';
const USER_DATA_STORAGE_KEY = 'gatewayz_user_data';

let hasLoggedStorageAccessError = false;

const logStorageAccessIssue = (error: unknown): void => {
  if (hasLoggedStorageAccessError) {
    return;
  }

  hasLoggedStorageAccessError = true;
  console.warn(
    '[storage] localStorage is not accessible in this environment. Falling back to safe defaults.',
    error
  );
};

const getLocalStorageSafe = (): Storage | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage;
  } catch (error) {
    logStorageAccessIssue(error);
    return null;
  }
};

export const AUTH_REFRESH_EVENT = 'gatewayz:refresh-auth';
export const AUTH_REFRESH_COMPLETE_EVENT = 'gatewayz:refresh-complete';
export const NEW_USER_WELCOME_EVENT = 'gatewayz:new-user-welcome';

export type UserTier = 'basic' | 'pro' | 'max';
export type SubscriptionStatus = 'active' | 'cancelled' | 'past_due' | 'inactive';

export interface AuthResponse {
  success: boolean;
  message: string;
  user_id: number;
  api_key: string;
  auth_method: string;
  privy_user_id: string;
  is_new_user: boolean;
  display_name: string;
  email: string;
  credits: number;
  timestamp: string | null;
  tier?: UserTier;
  tier_display_name?: string; // Formatted tier name from backend (e.g., "Pro", "MAX")
  subscription_status?: SubscriptionStatus;
  subscription_end_date?: number; // Unix timestamp
}

export interface UserData {
  user_id: number;
  api_key: string;
  auth_method: string;
  privy_user_id: string;
  display_name: string;
  email: string;
  credits: number;
  tier?: UserTier;
  tier_display_name?: string; // Formatted tier name from backend (e.g., "Pro", "MAX")
  subscription_status?: SubscriptionStatus;
  subscription_end_date?: number; // Unix timestamp
}

// API Key Management
export const saveApiKey = (apiKey: string): void => {
  const storage = getLocalStorageSafe();
  if (!storage) {
    return;
  }

  try {
    storage.setItem(API_KEY_STORAGE_KEY, apiKey);
  } catch (error) {
    logStorageAccessIssue(error);
  }
};

export const getApiKey = (): string | null => {
  const storage = getLocalStorageSafe();
  if (!storage) {
    return null;
  }

  try {
    const apiKey = storage.getItem(API_KEY_STORAGE_KEY);
    return apiKey && apiKey.trim().length > 0 ? apiKey : null;
  } catch (error) {
    logStorageAccessIssue(error);
    return null;
  }
};

/**
 * Get API key with retry logic for cases where localStorage hasn't synced yet
 * Useful during rapid auth transitions
 */
export const getApiKeyWithRetry = async (maxRetries: number = 3): Promise<string | null> => {
  for (let i = 0; i < maxRetries; i++) {
    const key = getApiKey();
    if (key) {
      console.log(`[getApiKeyWithRetry] Found API key on attempt ${i + 1}`);
      return key;
    }

    // Wait before retrying (exponential backoff)
    if (i < maxRetries - 1) {
      const delayMs = 100 * Math.pow(2, i);
      console.log(`[getApiKeyWithRetry] Retrying in ${delayMs}ms (attempt ${i + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  console.warn('[getApiKeyWithRetry] Failed to retrieve API key after', maxRetries, 'attempts');
  return null;
};

export const removeApiKey = (): void => {
  const storage = getLocalStorageSafe();
  if (!storage) {
    return;
  }

  try {
    storage.removeItem(API_KEY_STORAGE_KEY);
    storage.removeItem(USER_DATA_STORAGE_KEY);
  } catch (error) {
    logStorageAccessIssue(error);
  }
};

/**
 * Request an auth refresh and wait for completion
 * Returns a promise that resolves when the refresh is complete
 * Rejects if refresh times out (30 seconds)
 */
export const requestAuthRefresh = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('requestAuthRefresh called in non-browser environment'));
      return;
    }

    // Handler for completion event
    const handleCompletion = () => {
      window.removeEventListener(AUTH_REFRESH_COMPLETE_EVENT, handleCompletion);
      clearTimeout(timeoutId);
      resolve();
    };

    // Set timeout to prevent hanging if completion event never fires
    const timeoutId = setTimeout(() => {
      window.removeEventListener(AUTH_REFRESH_COMPLETE_EVENT, handleCompletion);
      console.error('[Auth] Auth refresh timed out after 30 seconds');
      reject(new Error('Auth refresh timeout'));
    }, 30000);

    // Listen for completion event
    window.addEventListener(AUTH_REFRESH_COMPLETE_EVENT, handleCompletion);

    // Dispatch refresh event to trigger auth context sync
    window.dispatchEvent(new Event(AUTH_REFRESH_EVENT));
  });
};

// User Data Management
export const saveUserData = (userData: UserData): void => {
  const storage = getLocalStorageSafe();
  if (!storage) {
    return;
  }

  try {
    storage.setItem(USER_DATA_STORAGE_KEY, JSON.stringify(userData));
  } catch (error) {
    logStorageAccessIssue(error);
  }
};

export const getUserData = (): UserData | null => {
  const storage = getLocalStorageSafe();
  if (!storage) {
    return null;
  }

  try {
    const data = storage.getItem(USER_DATA_STORAGE_KEY);
    if (!data) {
      return null;
    }

    try {
      return JSON.parse(data);
    } catch (parseError) {
      console.warn('[storage] Failed to parse user data from localStorage. Clearing corrupted value.', parseError);
      try {
        storage.removeItem(USER_DATA_STORAGE_KEY);
      } catch (error) {
        logStorageAccessIssue(error);
      }
      return null;
    }
  } catch (error) {
    logStorageAccessIssue(error);
    return null;
  }
};

// Authenticated API Request Helper
export const makeAuthenticatedRequest = async (
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> => {
  const apiKey = getApiKey();

  if (!apiKey) {
    throw new Error('No API key found. User must be authenticated.');
  }

  const defaultHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  };

  const requestOptions: RequestInit = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };

  const response = await fetch(endpoint, requestOptions);

  // If we get a 401, DO NOT immediately clear the API key
  // The 401 could be a temporary backend issue, not an actual session expiry
  // Let the calling code decide whether to refresh or logout
  if (response.status === 401) {
    console.warn('API key may be invalid (401 received), dispatching refresh event');
    // Dispatch refresh event to let auth context handle re-authentication
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(AUTH_REFRESH_EVENT));
    }
  }

  return response;
};

// Process authentication response
export const processAuthResponse = (response: AuthResponse): void => {
  console.log('Processing auth response:', {
    success: response.success,
    has_api_key: !!response.api_key,
    api_key_preview: response.api_key ? `${response.api_key.substring(0, 10)}...` : 'None',
    credits_raw: response.credits,
    credits_type: typeof response.credits,
  });

  // Validate API key is not empty or invalid
  if (!response.api_key || typeof response.api_key !== 'string' || response.api_key.trim().length === 0) {
    console.warn('[Auth] Missing or invalid API key in auth response, not storing credentials');
    return;
  }

  if (response.api_key) {
    saveApiKey(response.api_key);
    console.log('API key saved to localStorage');

    // Convert credits to integer to match backend expectations
    // Handle undefined/null/NaN cases
    const creditsAsInteger = response.credits !== undefined && response.credits !== null && !isNaN(response.credits)
      ? Math.floor(response.credits)
      : 0;

    console.log('[processAuthResponse] Credits conversion:', {
      original: response.credits,
      converted: creditsAsInteger,
    });

    const userData: UserData = {
      user_id: response.user_id,
      api_key: response.api_key,
      auth_method: response.auth_method,
      privy_user_id: response.privy_user_id,
      display_name: response.display_name,
      email: response.email,
      credits: creditsAsInteger,
      // Normalize tier to lowercase to handle case sensitivity from backend
      tier: response.tier?.toLowerCase() as UserTier | undefined,
      tier_display_name: response.tier_display_name,
      subscription_status: response.subscription_status,
      subscription_end_date: response.subscription_end_date,
    };

    saveUserData(userData);
    console.log('User data saved to localStorage:', userData);

    console.log('User authenticated successfully:', {
      user_id: response.user_id,
      display_name: response.display_name,
      credits: creditsAsInteger,
      original_credits: response.credits,
      is_new_user: response.is_new_user,
      tier: response.tier,
      subscription_status: response.subscription_status,
    });

    // Trigger welcome dialog for new users
    if (response.is_new_user && typeof window !== 'undefined') {
      console.log('[Auth] New user detected, triggering welcome dialog');
      const event = new CustomEvent(NEW_USER_WELCOME_EVENT, {
        detail: { credits: creditsAsInteger }
      });
      window.dispatchEvent(event);
    }
  } else {
    console.warn('Authentication response missing API key:', {
      success: response.success,
      has_api_key: !!response.api_key,
      response_keys: Object.keys(response)
    });
  }
};
