/**
 * Guest Chat Utilities
 * Manages guest mode chat functionality with 10-message limit
 */

const GUEST_MESSAGE_COUNT_KEY = 'gatewayz_guest_message_count';
const GUEST_MESSAGE_LIMIT = 10;

/**
 * Get the current guest message count
 */
export function getGuestMessageCount(): number {
  if (typeof window === 'undefined') return 0;

  const count = localStorage.getItem(GUEST_MESSAGE_COUNT_KEY);
  if (!count) return 0;

  const parsed = parseInt(count, 10);
  // Handle corrupted values - return 0 and clear if NaN
  if (isNaN(parsed)) {
    localStorage.removeItem(GUEST_MESSAGE_COUNT_KEY);
    return 0;
  }

  return parsed;
}

/**
 * Increment the guest message count
 * @returns The new count
 */
export function incrementGuestMessageCount(): number {
  if (typeof window === 'undefined') return 0;

  const current = getGuestMessageCount();
  const newCount = current + 1;
  localStorage.setItem(GUEST_MESSAGE_COUNT_KEY, newCount.toString());
  return newCount;
}

/**
 * Check if guest has reached the message limit
 */
export function hasReachedGuestLimit(): boolean {
  return getGuestMessageCount() >= GUEST_MESSAGE_LIMIT;
}

/**
 * Get remaining guest messages
 */
export function getRemainingGuestMessages(): number {
  const count = getGuestMessageCount();
  const remaining = GUEST_MESSAGE_LIMIT - count;
  return Math.max(0, remaining);
}

/**
 * Reset guest message count (called after user signs up)
 */
export function resetGuestMessageCount(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(GUEST_MESSAGE_COUNT_KEY);
}

/**
 * Check if user is in guest mode (not authenticated)
 */
export function isGuestMode(isAuthenticated: boolean): boolean {
  return !isAuthenticated;
}

/**
 * Get the guest message limit constant
 */
export function getGuestMessageLimit(): number {
  return GUEST_MESSAGE_LIMIT;
}
