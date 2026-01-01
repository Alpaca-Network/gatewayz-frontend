/**
 * User Factory
 *
 * Factory for creating test user data with realistic values.
 * Uses @faker-js/faker for generating random but realistic data.
 */

import { faker } from '@faker-js/faker'

export type UserTier = 'basic' | 'pro' | 'max'
export type SubscriptionStatus = 'active' | 'cancelled' | 'past_due' | 'inactive'

export interface User {
  id: number
  privyId: string
  email: string
  displayName: string
  apiKey: string
  credits: number
  tier: UserTier
  subscriptionStatus: SubscriptionStatus
  subscriptionEndDate?: number
  createdAt: string
  updatedAt: string
}

/**
 * Create a user with default/overridden values
 */
export function createUser(overrides?: Partial<User>): User {
  const tier = overrides?.tier || faker.helpers.arrayElement(['basic', 'pro', 'max'] as UserTier[])
  const subscriptionStatus = overrides?.subscriptionStatus ||
    (tier === 'basic' ? 'inactive' : 'active') as SubscriptionStatus

  return {
    id: faker.number.int({ min: 1, max: 100000 }),
    privyId: `privy-${faker.string.alphanumeric(16)}`,
    email: faker.internet.email(),
    displayName: faker.person.fullName(),
    apiKey: `gw_${faker.string.alphanumeric(32)}`,
    credits: getDefaultCreditsForTier(tier),
    tier,
    subscriptionStatus,
    subscriptionEndDate: subscriptionStatus === 'active'
      ? Date.now() + faker.number.int({ min: 1, max: 365 }) * 24 * 60 * 60 * 1000
      : undefined,
    createdAt: faker.date.past().toISOString(),
    updatedAt: faker.date.recent().toISOString(),
    ...overrides,
  }
}

/**
 * Create a basic tier user
 */
export function createBasicUser(overrides?: Partial<User>): User {
  return createUser({
    tier: 'basic',
    subscriptionStatus: 'inactive',
    credits: 1000,
    ...overrides,
  })
}

/**
 * Create a pro tier user
 */
export function createProUser(overrides?: Partial<User>): User {
  return createUser({
    tier: 'pro',
    subscriptionStatus: 'active',
    credits: 5000,
    subscriptionEndDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
    ...overrides,
  })
}

/**
 * Create a max tier user
 */
export function createMaxUser(overrides?: Partial<User>): User {
  return createUser({
    tier: 'max',
    subscriptionStatus: 'active',
    credits: 15000,
    subscriptionEndDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
    ...overrides,
  })
}

/**
 * Create a user with expired subscription
 */
export function createExpiredUser(overrides?: Partial<User>): User {
  return createUser({
    tier: 'pro',
    subscriptionStatus: 'cancelled',
    subscriptionEndDate: Date.now() - 7 * 24 * 60 * 60 * 1000, // 7 days ago
    ...overrides,
  })
}

/**
 * Create a user with low credits
 */
export function createLowCreditUser(overrides?: Partial<User>): User {
  return createUser({
    credits: faker.number.int({ min: 0, max: 100 }),
    ...overrides,
  })
}

/**
 * Create multiple users
 */
export function createUsers(count: number, overrides?: Partial<User>): User[] {
  return Array.from({ length: count }, () => createUser(overrides))
}

/**
 * Helper to get default credits for tier
 */
function getDefaultCreditsForTier(tier: UserTier): number {
  switch (tier) {
    case 'basic':
      return faker.number.int({ min: 500, max: 2000 })
    case 'pro':
      return faker.number.int({ min: 3000, max: 7000 })
    case 'max':
      return faker.number.int({ min: 10000, max: 20000 })
    default:
      return 1000
  }
}
