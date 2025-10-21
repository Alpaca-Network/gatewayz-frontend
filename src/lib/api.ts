// API utility functions for authenticated requests

const API_KEY_STORAGE_KEY = 'gatewayz_api_key';
const USER_DATA_STORAGE_KEY = 'gatewayz_user_data';

export const AUTH_REFRESH_EVENT = 'gatewayz:refresh-auth';
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
  subscription_status?: SubscriptionStatus;
  subscription_end_date?: number; // Unix timestamp
}

// API Key Management
export const saveApiKey = (apiKey: string): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(API_KEY_STORAGE_KEY, apiKey);
  }
};

export const getApiKey = (): string | null => {
  if (typeof window !== 'undefined') {
    const apiKey = localStorage.getItem(API_KEY_STORAGE_KEY);
    return apiKey;
  }
  return null;
};

export const removeApiKey = (): void => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(API_KEY_STORAGE_KEY);
    localStorage.removeItem(USER_DATA_STORAGE_KEY);
  }
};

export const requestAuthRefresh = (): void => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(AUTH_REFRESH_EVENT));
  }
};

// User Data Management
export const saveUserData = (userData: UserData): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(USER_DATA_STORAGE_KEY, JSON.stringify(userData));
  }
};

export const getUserData = (): UserData | null => {
  if (typeof window !== 'undefined') {
    const data = localStorage.getItem(USER_DATA_STORAGE_KEY);
    return data ? JSON.parse(data) : null;
  }
  return null;
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

  // If we get a 401, the API key is invalid - clear it
  if (response.status === 401) {
    console.warn('API key is invalid (401), clearing stored credentials');
    removeApiKey();
  }

  return response;
};

// Process authentication response
export const processAuthResponse = (response: AuthResponse): void => {
  console.log('Processing auth response:', {
    success: response.success,
    has_api_key: !!response.api_key,
    api_key_preview: response.api_key ? `${response.api_key.substring(0, 10)}...` : 'None'
  });

  if (response.success && response.api_key) {
    saveApiKey(response.api_key);
    console.log('API key saved to localStorage');

    // Convert credits to integer to match backend expectations
    const creditsAsInteger = Math.floor(response.credits);

    const userData: UserData = {
      user_id: response.user_id,
      api_key: response.api_key,
      auth_method: response.auth_method,
      privy_user_id: response.privy_user_id,
      display_name: response.display_name,
      email: response.email,
      credits: creditsAsInteger,
      tier: response.tier,
      subscription_status: response.subscription_status,
      subscription_end_date: response.subscription_end_date,
    };

    saveUserData(userData);
    console.log('User data saved to localStorage');

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
    console.warn('Authentication response invalid:', {
      success: response.success,
      has_api_key: !!response.api_key
    });
  }
};
