/**
 * Shared test constants for consistent mock data across test files
 *
 * Provides well-documented, reusable test data to avoid hardcoded
 * values scattered across tests
 *
 * NOTE: All API keys and credentials in this file are FAKE/MOCK values
 * used exclusively for unit testing. They do not represent real secrets.
 * ggignore - GitGuardian should ignore this file
 */

/**
 * Test timestamps with clear documentation
 */
export const TEST_TIMESTAMPS = {
  /** Base timestamp: 2023-11-14T22:13:20.000Z */
  NOW: 1700000000000,
  /** 10 minutes before NOW */
  PAST_10_MIN: 1700000000000 - 10 * 60 * 1000,
  /** 5 minutes before NOW */
  PAST_5_MIN: 1700000000000 - 5 * 60 * 1000,
  /** 2 minutes before NOW */
  PAST_2_MIN: 1700000000000 - 2 * 60 * 1000,
  /** 5 minutes after NOW */
  FUTURE_5_MIN: 1700000000000 + 5 * 60 * 1000,
  /** 10 minutes after NOW */
  FUTURE_10_MIN: 1700000000000 + 10 * 60 * 1000,
  /** 11 minutes after NOW (just past 10-minute expiry) */
  FUTURE_11_MIN: 1700000000000 + 11 * 60 * 1000,
  /** ISO string format of NOW */
  NOW_ISO: '2023-11-14T22:13:20.000Z',
  /** Test date for session creation */
  SESSION_DATE: '2025-01-01T00:00:00Z',
} as const;

/**
 * Test user data
 */
export const TEST_USER = {
  ID: 12345,
  PRIVY_ID: 'did:privy:test123',
  EMAIL: 'test@example.com',
  DISPLAY_NAME: 'Test User',
  CREDITS: 500,
  /** Fake test API key - not a real credential */
  API_KEY: 'test_fake_key_not_real_abc123',
} as const;

/**
 * Test user for new user scenarios
 */
export const TEST_NEW_USER = {
  ID: 99999,
  PRIVY_ID: 'did:privy:new456',
  EMAIL: 'newuser@example.com',
  DISPLAY_NAME: 'New User',
  CREDITS: 500, // Welcome credits
  /** Fake test API key - not a real credential */
  API_KEY: 'test_fake_newuser_key_xyz789',
} as const;

/**
 * Test user for pro tier scenarios
 */
export const TEST_PRO_USER = {
  ID: 55555,
  PRIVY_ID: 'did:privy:pro789',
  EMAIL: 'pro@example.com',
  DISPLAY_NAME: 'Pro User',
  CREDITS: 1000,
  /** Fake test API key - not a real credential */
  API_KEY: 'test_fake_prouser_key_123',
  TIER: 'pro' as const,
  SUBSCRIPTION_STATUS: 'active' as const,
  SUBSCRIPTION_END_DATE: 1735689600, // Some future timestamp
} as const;

/**
 * Test model data
 */
export const TEST_MODEL = {
  id: 'openai/gpt-4',
  name: 'GPT-4',
  description: 'Test model',
  context_length: 8000,
  pricing: { prompt: '0.01', completion: '0.03' },
  architecture: { input_modalities: ['text'], output_modalities: ['text'] },
  supported_parameters: ['temperature'],
  provider_slug: 'openai',
  source_gateway: 'openrouter',
} as const;

/**
 * Test chat session data
 */
export const TEST_SESSION = {
  id: 1,
  user_id: TEST_USER.ID,
  title: 'Test Session',
  model: 'gpt-4',
  created_at: TEST_TIMESTAMPS.SESSION_DATE,
  updated_at: TEST_TIMESTAMPS.SESSION_DATE,
  is_active: true,
} as const;

/**
 * Test chat message data
 */
export const TEST_MESSAGE = {
  USER: {
    id: 1,
    session_id: TEST_SESSION.id,
    role: 'user' as const,
    content: 'Hello, how are you?',
    created_at: TEST_TIMESTAMPS.SESSION_DATE,
  },
  ASSISTANT: {
    id: 2,
    session_id: TEST_SESSION.id,
    role: 'assistant' as const,
    content: 'I am doing well, thank you!',
    model: 'gpt-4',
    tokens: 15,
    created_at: TEST_TIMESTAMPS.SESSION_DATE,
  },
} as const;

/**
 * Create a mock auth response
 */
export function createMockAuthResponse(
  overrides: Partial<typeof TEST_USER> & {
    is_new_user?: boolean;
    tier?: string;
    subscription_status?: string;
    subscription_end_date?: number;
  } = {}
) {
  return {
    success: true,
    message: 'User authenticated successfully',
    user_id: overrides.ID ?? TEST_USER.ID,
    api_key: overrides.API_KEY ?? TEST_USER.API_KEY,
    auth_method: 'email',
    privy_user_id: overrides.PRIVY_ID ?? TEST_USER.PRIVY_ID,
    is_new_user: overrides.is_new_user ?? false,
    display_name: overrides.DISPLAY_NAME ?? TEST_USER.DISPLAY_NAME,
    email: overrides.EMAIL ?? TEST_USER.EMAIL,
    credits: overrides.CREDITS ?? TEST_USER.CREDITS,
    tier: overrides.tier,
    subscription_status: overrides.subscription_status,
    subscription_end_date: overrides.subscription_end_date,
    timestamp: TEST_TIMESTAMPS.NOW_ISO,
  };
}

/**
 * Create mock user data for localStorage
 */
export function createMockUserData(
  overrides: Partial<{
    user_id: number;
    api_key: string;
    email: string;
    display_name: string;
    credits: number;
    tier: string;
    subscription_status: string;
    subscription_end_date: number;
  }> = {}
) {
  return {
    user_id: overrides.user_id ?? TEST_USER.ID,
    api_key: overrides.api_key ?? TEST_USER.API_KEY,
    auth_method: 'email',
    privy_user_id: TEST_USER.PRIVY_ID,
    display_name: overrides.display_name ?? TEST_USER.DISPLAY_NAME,
    email: overrides.email ?? TEST_USER.EMAIL,
    credits: overrides.credits ?? TEST_USER.CREDITS,
    tier: overrides.tier,
    subscription_status: overrides.subscription_status,
    subscription_end_date: overrides.subscription_end_date,
  };
}
