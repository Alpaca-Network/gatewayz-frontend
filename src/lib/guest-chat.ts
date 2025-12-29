/**
 * Guest Chat Utilities
 * Manages guest mode chat functionality with 10-message limit
 * and persistent storage-based chat history for unauthenticated users
 * with safe storage fallback
 */

import type { ChatSession, ChatMessage } from './chat-history';
import { safeLocalStorageGet, safeLocalStorageSet, safeLocalStorageRemove } from './safe-storage';

const GUEST_MESSAGE_DATA_KEY = 'gatewayz_guest_message_data';
const GUEST_DAILY_MESSAGE_LIMIT = 3;
const GUEST_SESSIONS_KEY = 'gatewayz_guest_sessions';
const GUEST_MESSAGES_KEY = 'gatewayz_guest_messages';
const GUEST_SESSION_TTL_DAYS = 7; // Sessions expire after 7 days
const MAX_GUEST_SESSIONS = 20; // Maximum number of guest sessions to store

/**
 * Data structure for tracking daily guest messages
 */
interface GuestMessageData {
  count: number;
  date: string; // ISO date string (YYYY-MM-DD)
}

/**
 * Get today's date as ISO string (YYYY-MM-DD)
 */
function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Get the guest message data, resetting if it's a new day
 */
function getGuestMessageData(): GuestMessageData {
  if (typeof window === 'undefined') return { count: 0, date: getTodayDateString() };

  try {
    const stored = safeLocalStorageGet(GUEST_MESSAGE_DATA_KEY);
    if (!stored) return { count: 0, date: getTodayDateString() };

    const data: GuestMessageData = JSON.parse(stored);
    const today = getTodayDateString();

    // Reset count if it's a new day
    if (data.date !== today) {
      const newData = { count: 0, date: today };
      safeLocalStorageSet(GUEST_MESSAGE_DATA_KEY, JSON.stringify(newData));
      return newData;
    }

    return data;
  } catch {
    // Handle corrupted data
    const newData = { count: 0, date: getTodayDateString() };
    safeLocalStorageSet(GUEST_MESSAGE_DATA_KEY, JSON.stringify(newData));
    return newData;
  }
}

/**
 * Get the current guest message count for today
 */
export function getGuestMessageCount(): number {
  return getGuestMessageData().count;
}

/**
 * Increment the guest message count
 * @returns The new count
 */
export function incrementGuestMessageCount(): number {
  if (typeof window === 'undefined') return 0;

  const data = getGuestMessageData();
  const newData = { count: data.count + 1, date: data.date };
  safeLocalStorageSet(GUEST_MESSAGE_DATA_KEY, JSON.stringify(newData));
  return newData.count;
}

/**
 * Check if guest has reached the daily message limit
 */
export function hasReachedGuestLimit(): boolean {
  return getGuestMessageCount() >= GUEST_DAILY_MESSAGE_LIMIT;
}

/**
 * Get remaining guest messages for today
 */
export function getRemainingGuestMessages(): number {
  const count = getGuestMessageCount();
  const remaining = GUEST_DAILY_MESSAGE_LIMIT - count;
  return Math.max(0, remaining);
}

/**
 * Reset guest message count (called after user signs up)
 */
export function resetGuestMessageCount(): void {
  if (typeof window === 'undefined') return;
  safeLocalStorageRemove(GUEST_MESSAGE_DATA_KEY);
}

/**
 * Check if user is in guest mode (not authenticated)
 */
export function isGuestMode(isAuthenticated: boolean): boolean {
  return !isAuthenticated;
}

/**
 * Get the daily guest message limit constant
 */
export function getGuestMessageLimit(): number {
  return GUEST_DAILY_MESSAGE_LIMIT;
}

// ============================================================================
// Guest Session & Message Storage (localStorage-based persistence)
// ============================================================================

/**
 * Internal type for storing sessions with metadata
 */
interface StoredGuestSession extends ChatSession {
  _storedAt: number; // Timestamp when session was stored
}

/**
 * Internal type for storing messages mapped by session ID
 */
interface StoredGuestMessages {
  [sessionId: string]: ChatMessage[];
}

/**
 * Get all guest sessions from localStorage
 */
export function getGuestSessions(): ChatSession[] {
  if (typeof window === 'undefined') return [];

  try {
    const stored = safeLocalStorageGet(GUEST_SESSIONS_KEY);
    if (!stored) return [];

    const sessions: StoredGuestSession[] = JSON.parse(stored);
    const now = Date.now();
    const ttlMs = GUEST_SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;

    // Filter out expired sessions
    const validSessions = sessions.filter(s => {
      const age = now - s._storedAt;
      return age < ttlMs;
    });

    // Clean up expired sessions if any were removed
    if (validSessions.length !== sessions.length) {
      saveGuestSessionsInternal(validSessions);
      cleanupOrphanedMessages(validSessions.map(s => s.id));
    }

    // Return sessions without internal metadata, sorted by updated_at desc
    return validSessions
      .map(({ _storedAt, ...session }) => session)
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  } catch (error) {
    console.error('[GuestChat] Failed to get sessions:', error);
    return [];
  }
}

/**
 * Get a specific guest session by ID
 */
export function getGuestSession(sessionId: number): ChatSession | null {
  const sessions = getGuestSessions();
  return sessions.find(s => s.id === sessionId) || null;
}

/**
 * Get messages for a guest session
 */
export function getGuestMessages(sessionId: number): ChatMessage[] {
  if (typeof window === 'undefined') return [];

  try {
    const stored = safeLocalStorageGet(GUEST_MESSAGES_KEY);
    if (!stored) return [];

    const allMessages: StoredGuestMessages = JSON.parse(stored);
    return allMessages[sessionId.toString()] || [];
  } catch (error) {
    console.error('[GuestChat] Failed to get messages:', error);
    return [];
  }
}

/**
 * Save a new guest session
 */
export function saveGuestSession(session: ChatSession): void {
  if (typeof window === 'undefined') return;

  try {
    const sessions = getStoredSessions();

    // Check if session already exists (update case)
    const existingIndex = sessions.findIndex(s => s.id === session.id);

    const storedSession: StoredGuestSession = {
      ...session,
      _storedAt: existingIndex >= 0 ? sessions[existingIndex]._storedAt : Date.now()
    };

    if (existingIndex >= 0) {
      // Update existing session
      sessions[existingIndex] = storedSession;
    } else {
      // Add new session, enforce max limit
      sessions.unshift(storedSession);
      if (sessions.length > MAX_GUEST_SESSIONS) {
        const removed = sessions.splice(MAX_GUEST_SESSIONS);
        // Clean up messages for removed sessions
        cleanupOrphanedMessages(sessions.map(s => s.id));
      }
    }

    saveGuestSessionsInternal(sessions);
  } catch (error) {
    console.error('[GuestChat] Failed to save session:', error);
  }
}

/**
 * Update a guest session's properties
 */
export function updateGuestSession(sessionId: number, updates: Partial<ChatSession>): void {
  if (typeof window === 'undefined') return;

  try {
    const sessions = getStoredSessions();
    const index = sessions.findIndex(s => s.id === sessionId);

    if (index >= 0) {
      sessions[index] = {
        ...sessions[index],
        ...updates,
        updated_at: new Date().toISOString()
      };
      saveGuestSessionsInternal(sessions);
    }
  } catch (error) {
    console.error('[GuestChat] Failed to update session:', error);
  }
}

/**
 * Delete a guest session and its messages
 */
export function deleteGuestSession(sessionId: number): void {
  if (typeof window === 'undefined') return;

  try {
    // Remove session
    const sessions = getStoredSessions();
    const filtered = sessions.filter(s => s.id !== sessionId);
    saveGuestSessionsInternal(filtered);

    // Remove messages for this session
    const stored = safeLocalStorageGet(GUEST_MESSAGES_KEY);
    if (stored) {
      const allMessages: StoredGuestMessages = JSON.parse(stored);
      delete allMessages[sessionId.toString()];
      safeLocalStorageSet(GUEST_MESSAGES_KEY, JSON.stringify(allMessages));
    }
  } catch (error) {
    console.error('[GuestChat] Failed to delete session:', error);
  }
}

/**
 * Save a message to a guest session
 * Supports optional reasoning field for chain-of-thought models
 */
export function saveGuestMessage(
  sessionId: number,
  message: Omit<ChatMessage, 'id' | 'session_id'>
): ChatMessage {
  if (typeof window === 'undefined') {
    // Return a placeholder for SSR
    return {
      id: -Date.now(),
      session_id: sessionId,
      ...message
    } as ChatMessage;
  }

  try {
    const stored = safeLocalStorageGet(GUEST_MESSAGES_KEY);
    const allMessages: StoredGuestMessages = stored ? JSON.parse(stored) : {};
    const sessionKey = sessionId.toString();

    if (!allMessages[sessionKey]) {
      allMessages[sessionKey] = [];
    }

    // Generate unique negative ID for guest messages
    const newMessage: ChatMessage = {
      id: -Date.now() - Math.random(), // Unique negative ID
      session_id: sessionId,
      ...message
    } as ChatMessage;

    allMessages[sessionKey].push(newMessage);

    // Limit messages per session to prevent storage bloat (keep last 100)
    if (allMessages[sessionKey].length > 100) {
      allMessages[sessionKey] = allMessages[sessionKey].slice(-100);
    }

    safeLocalStorageSet(GUEST_MESSAGES_KEY, JSON.stringify(allMessages));

    // Update session's updated_at timestamp
    updateGuestSession(sessionId, {});

    return newMessage;
  } catch (error) {
    console.error('[GuestChat] Failed to save message:', error);
    // Return a temporary message even on error
    return {
      id: -Date.now(),
      session_id: sessionId,
      ...message
    } as ChatMessage;
  }
}

/**
 * Clear all guest chat data (sessions and messages)
 */
export function clearGuestChatData(): void {
  if (typeof window === 'undefined') return;

  try {
    safeLocalStorageRemove(GUEST_SESSIONS_KEY);
    safeLocalStorageRemove(GUEST_MESSAGES_KEY);
    safeLocalStorageRemove(GUEST_MESSAGE_DATA_KEY);
  } catch (error) {
    console.error('[GuestChat] Failed to clear chat data:', error);
  }
}

/**
 * Get all guest data for migration when user signs up
 * Returns sessions with their messages attached
 */
export function getGuestDataForMigration(): Array<ChatSession & { messages: ChatMessage[] }> {
  const sessions = getGuestSessions();
  return sessions.map(session => ({
    ...session,
    messages: getGuestMessages(session.id)
  }));
}

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Get raw stored sessions with metadata
 */
function getStoredSessions(): StoredGuestSession[] {
  if (typeof window === 'undefined') return [];

  try {
    const stored = safeLocalStorageGet(GUEST_SESSIONS_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

/**
 * Save sessions to localStorage
 */
function saveGuestSessionsInternal(sessions: StoredGuestSession[]): void {
  if (typeof window === 'undefined') return;
  safeLocalStorageSet(GUEST_SESSIONS_KEY, JSON.stringify(sessions));
}

/**
 * Remove messages for sessions that no longer exist
 */
function cleanupOrphanedMessages(validSessionIds: number[]): void {
  if (typeof window === 'undefined') return;

  try {
    const stored = safeLocalStorageGet(GUEST_MESSAGES_KEY);
    if (!stored) return;

    const allMessages: StoredGuestMessages = JSON.parse(stored);
    const validIds = new Set(validSessionIds.map(id => id.toString()));

    const cleaned: StoredGuestMessages = {};
    for (const [sessionId, messages] of Object.entries(allMessages)) {
      if (validIds.has(sessionId)) {
        cleaned[sessionId] = messages;
      }
    }

    safeLocalStorageSet(GUEST_MESSAGES_KEY, JSON.stringify(cleaned));
  } catch (error) {
    console.error('[GuestChat] Failed to cleanup orphaned messages:', error);
  }
}
