/**
 * @jest-environment jsdom
 */
import {
  getGuestMessageCount,
  incrementGuestMessageCount,
  hasReachedGuestLimit,
  getRemainingGuestMessages,
  resetGuestMessageCount,
  isGuestMode,
  getGuestMessageLimit,
  getGuestSessions,
  getGuestSession,
  getGuestMessages,
  saveGuestSession,
  updateGuestSession,
  deleteGuestSession,
  saveGuestMessage,
  clearGuestChatData,
  getGuestDataForMigration,
} from '../guest-chat';
import type { ChatSession, ChatMessage } from '../chat-history';

// Storage keys (must match those in guest-chat.ts)
const GUEST_MESSAGE_COUNT_KEY = 'gatewayz_guest_message_count';
const GUEST_SESSIONS_KEY = 'gatewayz_guest_sessions';
const GUEST_MESSAGES_KEY = 'gatewayz_guest_messages';

describe('Guest Chat Utilities', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    jest.clearAllMocks();
  });

  // ============================================================================
  // Message Count Tests
  // ============================================================================
  describe('Message Count Functions', () => {
    describe('getGuestMessageCount', () => {
      it('should return 0 when no count exists', () => {
        expect(getGuestMessageCount()).toBe(0);
      });

      it('should return stored count', () => {
        localStorage.setItem(GUEST_MESSAGE_COUNT_KEY, '5');
        expect(getGuestMessageCount()).toBe(5);
      });

      it('should return 0 and clear storage for corrupted values', () => {
        localStorage.setItem(GUEST_MESSAGE_COUNT_KEY, 'invalid');
        expect(getGuestMessageCount()).toBe(0);
        expect(localStorage.getItem(GUEST_MESSAGE_COUNT_KEY)).toBeNull();
      });
    });

    describe('incrementGuestMessageCount', () => {
      it('should increment from 0', () => {
        expect(incrementGuestMessageCount()).toBe(1);
        expect(localStorage.getItem(GUEST_MESSAGE_COUNT_KEY)).toBe('1');
      });

      it('should increment existing count', () => {
        localStorage.setItem(GUEST_MESSAGE_COUNT_KEY, '5');
        expect(incrementGuestMessageCount()).toBe(6);
        expect(localStorage.getItem(GUEST_MESSAGE_COUNT_KEY)).toBe('6');
      });
    });

    describe('hasReachedGuestLimit', () => {
      it('should return false when under limit', () => {
        localStorage.setItem(GUEST_MESSAGE_COUNT_KEY, '5');
        expect(hasReachedGuestLimit()).toBe(false);
      });

      it('should return true when at limit', () => {
        localStorage.setItem(GUEST_MESSAGE_COUNT_KEY, '10');
        expect(hasReachedGuestLimit()).toBe(true);
      });

      it('should return true when over limit', () => {
        localStorage.setItem(GUEST_MESSAGE_COUNT_KEY, '15');
        expect(hasReachedGuestLimit()).toBe(true);
      });
    });

    describe('getRemainingGuestMessages', () => {
      it('should return full limit when no messages sent', () => {
        expect(getRemainingGuestMessages()).toBe(10);
      });

      it('should return remaining count', () => {
        localStorage.setItem(GUEST_MESSAGE_COUNT_KEY, '7');
        expect(getRemainingGuestMessages()).toBe(3);
      });

      it('should return 0 when at or over limit', () => {
        localStorage.setItem(GUEST_MESSAGE_COUNT_KEY, '12');
        expect(getRemainingGuestMessages()).toBe(0);
      });
    });

    describe('resetGuestMessageCount', () => {
      it('should remove the count from storage', () => {
        localStorage.setItem(GUEST_MESSAGE_COUNT_KEY, '5');
        resetGuestMessageCount();
        expect(localStorage.getItem(GUEST_MESSAGE_COUNT_KEY)).toBeNull();
      });
    });

    describe('isGuestMode', () => {
      it('should return true when not authenticated', () => {
        expect(isGuestMode(false)).toBe(true);
      });

      it('should return false when authenticated', () => {
        expect(isGuestMode(true)).toBe(false);
      });
    });

    describe('getGuestMessageLimit', () => {
      it('should return 10', () => {
        expect(getGuestMessageLimit()).toBe(10);
      });
    });
  });

  // ============================================================================
  // Session Storage Tests
  // ============================================================================
  describe('Session Storage Functions', () => {
    const createMockSession = (id: number, title: string = 'Test Chat'): ChatSession => ({
      id,
      user_id: -1,
      title,
      model: 'openai/gpt-3.5-turbo',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_active: true,
    });

    describe('getGuestSessions', () => {
      it('should return empty array when no sessions exist', () => {
        expect(getGuestSessions()).toEqual([]);
      });

      it('should return stored sessions', () => {
        const session = createMockSession(-1);
        const storedSession = { ...session, _storedAt: Date.now() };
        localStorage.setItem(GUEST_SESSIONS_KEY, JSON.stringify([storedSession]));

        const result = getGuestSessions();
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe(-1);
        expect(result[0].title).toBe('Test Chat');
      });

      it('should filter out expired sessions (older than 7 days)', () => {
        const now = Date.now();
        const eightDaysAgo = now - 8 * 24 * 60 * 60 * 1000;

        const validSession = { ...createMockSession(-1, 'Valid'), _storedAt: now };
        const expiredSession = { ...createMockSession(-2, 'Expired'), _storedAt: eightDaysAgo };

        localStorage.setItem(GUEST_SESSIONS_KEY, JSON.stringify([validSession, expiredSession]));

        const result = getGuestSessions();
        expect(result).toHaveLength(1);
        expect(result[0].title).toBe('Valid');
      });

      it('should sort sessions by updated_at descending', () => {
        const older = {
          ...createMockSession(-1, 'Older'),
          updated_at: '2025-01-01T00:00:00Z',
          _storedAt: Date.now(),
        };
        const newer = {
          ...createMockSession(-2, 'Newer'),
          updated_at: '2025-01-02T00:00:00Z',
          _storedAt: Date.now(),
        };

        localStorage.setItem(GUEST_SESSIONS_KEY, JSON.stringify([older, newer]));

        const result = getGuestSessions();
        expect(result[0].title).toBe('Newer');
        expect(result[1].title).toBe('Older');
      });

      it('should handle corrupted JSON gracefully', () => {
        localStorage.setItem(GUEST_SESSIONS_KEY, 'invalid json');
        expect(getGuestSessions()).toEqual([]);
      });
    });

    describe('getGuestSession', () => {
      it('should return null when session not found', () => {
        expect(getGuestSession(-999)).toBeNull();
      });

      it('should return the session when found', () => {
        const session = { ...createMockSession(-1), _storedAt: Date.now() };
        localStorage.setItem(GUEST_SESSIONS_KEY, JSON.stringify([session]));

        const result = getGuestSession(-1);
        expect(result).not.toBeNull();
        expect(result?.id).toBe(-1);
      });
    });

    describe('saveGuestSession', () => {
      it('should save a new session', () => {
        const session = createMockSession(-1);
        saveGuestSession(session);

        const stored = JSON.parse(localStorage.getItem(GUEST_SESSIONS_KEY) || '[]');
        expect(stored).toHaveLength(1);
        expect(stored[0].id).toBe(-1);
        expect(stored[0]._storedAt).toBeDefined();
      });

      it('should update an existing session', () => {
        const session = { ...createMockSession(-1), _storedAt: Date.now() };
        localStorage.setItem(GUEST_SESSIONS_KEY, JSON.stringify([session]));

        const updatedSession = { ...session, title: 'Updated Title' };
        saveGuestSession(updatedSession);

        const stored = JSON.parse(localStorage.getItem(GUEST_SESSIONS_KEY) || '[]');
        expect(stored).toHaveLength(1);
        expect(stored[0].title).toBe('Updated Title');
      });

      it('should enforce maximum session limit', () => {
        // Create 21 sessions (exceeds MAX_GUEST_SESSIONS of 20)
        const sessions = Array.from({ length: 21 }, (_, i) => ({
          ...createMockSession(-i - 1, `Session ${i}`),
          _storedAt: Date.now() - i * 1000, // Older sessions have earlier timestamps
        }));

        // Save first 20
        localStorage.setItem(GUEST_SESSIONS_KEY, JSON.stringify(sessions.slice(0, 20)));

        // Save one more
        saveGuestSession(createMockSession(-100, 'New Session'));

        const stored = JSON.parse(localStorage.getItem(GUEST_SESSIONS_KEY) || '[]');
        expect(stored.length).toBeLessThanOrEqual(20);
      });
    });

    describe('updateGuestSession', () => {
      it('should update session properties', () => {
        const oldDate = '2025-01-01T00:00:00Z';
        const session = { ...createMockSession(-1), updated_at: oldDate, _storedAt: Date.now() };
        localStorage.setItem(GUEST_SESSIONS_KEY, JSON.stringify([session]));

        updateGuestSession(-1, { title: 'New Title' });

        const stored = JSON.parse(localStorage.getItem(GUEST_SESSIONS_KEY) || '[]');
        expect(stored[0].title).toBe('New Title');
        expect(new Date(stored[0].updated_at).getTime()).toBeGreaterThan(
          new Date(oldDate).getTime()
        );
      });

      it('should do nothing when session not found', () => {
        updateGuestSession(-999, { title: 'New Title' });
        expect(localStorage.getItem(GUEST_SESSIONS_KEY)).toBeNull();
      });
    });

    describe('deleteGuestSession', () => {
      it('should remove session from storage', () => {
        const session = { ...createMockSession(-1), _storedAt: Date.now() };
        localStorage.setItem(GUEST_SESSIONS_KEY, JSON.stringify([session]));

        deleteGuestSession(-1);

        const stored = JSON.parse(localStorage.getItem(GUEST_SESSIONS_KEY) || '[]');
        expect(stored).toHaveLength(0);
      });

      it('should also remove associated messages', () => {
        const session = { ...createMockSession(-1), _storedAt: Date.now() };
        localStorage.setItem(GUEST_SESSIONS_KEY, JSON.stringify([session]));
        localStorage.setItem(GUEST_MESSAGES_KEY, JSON.stringify({ '-1': [{ id: -1, content: 'test' }] }));

        deleteGuestSession(-1);

        const messages = JSON.parse(localStorage.getItem(GUEST_MESSAGES_KEY) || '{}');
        expect(messages['-1']).toBeUndefined();
      });
    });
  });

  // ============================================================================
  // Message Storage Tests
  // ============================================================================
  describe('Message Storage Functions', () => {
    const createMockMessage = (role: 'user' | 'assistant', content: string) => ({
      role,
      content,
      model: 'openai/gpt-3.5-turbo',
      created_at: new Date().toISOString(),
    });

    describe('getGuestMessages', () => {
      it('should return empty array when no messages exist', () => {
        expect(getGuestMessages(-1)).toEqual([]);
      });

      it('should return messages for the session', () => {
        const messages = [
          { id: -1, session_id: -1, role: 'user', content: 'Hello', created_at: new Date().toISOString() },
        ];
        localStorage.setItem(GUEST_MESSAGES_KEY, JSON.stringify({ '-1': messages }));

        const result = getGuestMessages(-1);
        expect(result).toHaveLength(1);
        expect(result[0].content).toBe('Hello');
      });

      it('should return empty array for non-existent session', () => {
        localStorage.setItem(GUEST_MESSAGES_KEY, JSON.stringify({ '-1': [] }));
        expect(getGuestMessages(-999)).toEqual([]);
      });

      it('should handle corrupted JSON gracefully', () => {
        localStorage.setItem(GUEST_MESSAGES_KEY, 'invalid json');
        expect(getGuestMessages(-1)).toEqual([]);
      });
    });

    describe('saveGuestMessage', () => {
      it('should save a new message', () => {
        const message = createMockMessage('user', 'Hello');
        const result = saveGuestMessage(-1, message);

        expect(result.id).toBeLessThan(0);
        expect(result.session_id).toBe(-1);
        expect(result.content).toBe('Hello');

        const stored = JSON.parse(localStorage.getItem(GUEST_MESSAGES_KEY) || '{}');
        expect(stored['-1']).toHaveLength(1);
      });

      it('should append to existing messages', () => {
        const existing = [{ id: -1, session_id: -1, role: 'user', content: 'First', created_at: new Date().toISOString() }];
        localStorage.setItem(GUEST_MESSAGES_KEY, JSON.stringify({ '-1': existing }));

        saveGuestMessage(-1, createMockMessage('assistant', 'Second'));

        const stored = JSON.parse(localStorage.getItem(GUEST_MESSAGES_KEY) || '{}');
        expect(stored['-1']).toHaveLength(2);
      });

      it('should limit messages per session to 100', () => {
        // Create 100 existing messages
        const existing = Array.from({ length: 100 }, (_, i) => ({
          id: -i - 1,
          session_id: -1,
          role: 'user' as const,
          content: `Message ${i}`,
          created_at: new Date().toISOString(),
        }));
        localStorage.setItem(GUEST_MESSAGES_KEY, JSON.stringify({ '-1': existing }));

        saveGuestMessage(-1, createMockMessage('user', 'New Message'));

        const stored = JSON.parse(localStorage.getItem(GUEST_MESSAGES_KEY) || '{}');
        expect(stored['-1']).toHaveLength(100);
        expect(stored['-1'][99].content).toBe('New Message');
      });

      it('should update session updated_at timestamp', () => {
        const session = {
          id: -1,
          user_id: -1,
          title: 'Test',
          model: 'gpt-3.5-turbo',
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
          is_active: true,
          _storedAt: Date.now(),
        };
        localStorage.setItem(GUEST_SESSIONS_KEY, JSON.stringify([session]));

        saveGuestMessage(-1, createMockMessage('user', 'Hello'));

        const stored = JSON.parse(localStorage.getItem(GUEST_SESSIONS_KEY) || '[]');
        expect(new Date(stored[0].updated_at).getTime()).toBeGreaterThan(
          new Date('2025-01-01T00:00:00Z').getTime()
        );
      });
    });
  });

  // ============================================================================
  // Utility Functions Tests
  // ============================================================================
  describe('Utility Functions', () => {
    describe('clearGuestChatData', () => {
      it('should clear all guest data', () => {
        localStorage.setItem(GUEST_SESSIONS_KEY, JSON.stringify([{ id: -1 }]));
        localStorage.setItem(GUEST_MESSAGES_KEY, JSON.stringify({ '-1': [] }));
        localStorage.setItem(GUEST_MESSAGE_COUNT_KEY, '5');

        clearGuestChatData();

        expect(localStorage.getItem(GUEST_SESSIONS_KEY)).toBeNull();
        expect(localStorage.getItem(GUEST_MESSAGES_KEY)).toBeNull();
        expect(localStorage.getItem(GUEST_MESSAGE_COUNT_KEY)).toBeNull();
      });
    });

    describe('getGuestDataForMigration', () => {
      it('should return sessions with their messages', () => {
        const session = {
          id: -1,
          user_id: -1,
          title: 'Test',
          model: 'gpt-3.5-turbo',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_active: true,
          _storedAt: Date.now(),
        };
        const messages = [
          { id: -1, session_id: -1, role: 'user', content: 'Hello', created_at: new Date().toISOString() },
        ];

        localStorage.setItem(GUEST_SESSIONS_KEY, JSON.stringify([session]));
        localStorage.setItem(GUEST_MESSAGES_KEY, JSON.stringify({ '-1': messages }));

        const result = getGuestDataForMigration();

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe(-1);
        expect(result[0].messages).toHaveLength(1);
        expect(result[0].messages[0].content).toBe('Hello');
      });

      it('should return empty array when no data exists', () => {
        expect(getGuestDataForMigration()).toEqual([]);
      });
    });
  });
});
