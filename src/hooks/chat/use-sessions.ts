'use client';

/**
 * useSessions Hook
 *
 * Manages chat session lifecycle:
 * - Session CRUD operations
 * - Active session tracking
 * - Session list with grouping
 * - Optimistic updates
 */

import { useState, useCallback, useMemo, useRef } from 'react';
import {
  ChatSession,
  UseSessionsReturn,
  SessionsApiResponse,
  toSession,
  groupSessionsByDate,
} from './types';
import { getApiKey } from '@/lib/auth';

// =============================================================================
// CONSTANTS
// =============================================================================

const API_BASE = '/api/chat/sessions';
const DEFAULT_TIMEOUT = 15000; // 15 seconds
const SESSION_CREATION_TIMEOUT = 30000; // 30 seconds for creation

// =============================================================================
// HELPER: Fetch with timeout
// =============================================================================

async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeout?: number } = {}
): Promise<Response> {
  const { timeout = DEFAULT_TIMEOUT, ...fetchOptions } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    return await fetch(url, { ...fetchOptions, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

// =============================================================================
// HOOK
// =============================================================================

interface UseSessionsOptions {
  initialSessions?: ChatSession[];
  onSessionChange?: (session: ChatSession | null) => void;
}

export function useSessions(options: UseSessionsOptions = {}): UseSessionsReturn {
  const { initialSessions = [], onSessionChange } = options;

  // State
  const [sessions, setSessions] = useState<ChatSession[]>(initialSessions);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs for preventing race conditions
  const creatingRef = useRef(false);
  const loadingRef = useRef(false);

  // ===========================================================================
  // COMPUTED
  // ===========================================================================

  const activeSession = useMemo(() => {
    if (activeSessionId === null) return null;
    return sessions.find(s => s.id === activeSessionId) ?? null;
  }, [sessions, activeSessionId]);

  const groupedSessions = useMemo(() => {
    // Sort by updated date, newest first
    const sorted = [...sessions].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    return groupSessionsByDate(sorted);
  }, [sessions]);

  // ===========================================================================
  // API HELPERS
  // ===========================================================================

  const getAuthHeaders = useCallback((): HeadersInit => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error('Not authenticated');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    };
  }, []);

  // ===========================================================================
  // ACTIONS
  // ===========================================================================

  const refreshSessions = useCallback(async (): Promise<void> => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetchWithTimeout(API_BASE, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to load sessions: ${response.status}`);
      }

      const data = await response.json() as SessionsApiResponse;
      const newSessions = (data.sessions || []).map(toSession);

      setSessions(newSessions);

      // If active session no longer exists, clear it
      if (activeSessionId && !newSessions.find(s => s.id === activeSessionId)) {
        setActiveSessionId(null);
        onSessionChange?.(null);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load sessions';
      setError(message);
      console.error('[useSessions] Error refreshing:', err);
    } finally {
      setIsLoading(false);
      loadingRef.current = false;
    }
  }, [getAuthHeaders, activeSessionId, onSessionChange]);

  const createSession = useCallback(async (
    title?: string,
    model?: string
  ): Promise<ChatSession | null> => {
    // Prevent concurrent creation
    if (creatingRef.current) {
      console.warn('[useSessions] Session creation already in progress');
      return null;
    }

    creatingRef.current = true;
    setError(null);

    try {
      const response = await fetchWithTimeout(API_BASE, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          title: title || 'New Chat',
          model: model || 'fireworks/deepseek-r1',
        }),
        timeout: SESSION_CREATION_TIMEOUT,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`Failed to create session: ${errorText}`);
      }

      const data = await response.json();
      const sessionData = data.session || data;

      // Validate the response has required session fields
      if (!sessionData || typeof sessionData.id !== 'number') {
        console.error('[useSessions] Invalid session response:', data);
        throw new Error('Failed to create session: Invalid response from server');
      }

      const newSession = toSession(sessionData);

      // Optimistic update - add to beginning of list
      setSessions(prev => [newSession, ...prev]);

      // Set as active
      setActiveSessionId(newSession.id);
      onSessionChange?.(newSession);

      return newSession;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create session';
      setError(message);
      console.error('[useSessions] Error creating:', err);
      return null;
    } finally {
      creatingRef.current = false;
    }
  }, [getAuthHeaders, onSessionChange]);

  const selectSession = useCallback((sessionId: number): void => {
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      setActiveSessionId(sessionId);
      onSessionChange?.(session);
    }
  }, [sessions, onSessionChange]);

  const updateSession = useCallback(async (
    sessionId: number,
    updates: Partial<Pick<ChatSession, 'title' | 'model'>>
  ): Promise<void> => {
    // Optimistic update
    setSessions(prev =>
      prev.map(s =>
        s.id === sessionId
          ? { ...s, ...updates, updatedAt: new Date().toISOString() }
          : s
      )
    );

    try {
      const response = await fetchWithTimeout(`${API_BASE}/${sessionId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error(`Failed to update session: ${response.status}`);
      }

      // Update with server response
      const data = await response.json();
      if (data.session) {
        const updated = toSession(data.session);
        setSessions(prev =>
          prev.map(s => s.id === sessionId ? updated : s)
        );

        if (activeSessionId === sessionId) {
          onSessionChange?.(updated);
        }
      }
    } catch (err) {
      // Revert optimistic update
      await refreshSessions();
      const message = err instanceof Error ? err.message : 'Failed to update session';
      setError(message);
      console.error('[useSessions] Error updating:', err);
    }
  }, [getAuthHeaders, activeSessionId, onSessionChange, refreshSessions]);

  const deleteSession = useCallback(async (sessionId: number): Promise<void> => {
    // Optimistic update
    const previousSessions = sessions;
    setSessions(prev => prev.filter(s => s.id !== sessionId));

    // If deleting active session, clear it
    if (activeSessionId === sessionId) {
      setActiveSessionId(null);
      onSessionChange?.(null);
    }

    try {
      const response = await fetchWithTimeout(`${API_BASE}/${sessionId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to delete session: ${response.status}`);
      }
    } catch (err) {
      // Revert optimistic update
      setSessions(previousSessions);
      if (activeSessionId === sessionId) {
        const session = previousSessions.find(s => s.id === sessionId);
        if (session) {
          setActiveSessionId(sessionId);
          onSessionChange?.(session);
        }
      }

      const message = err instanceof Error ? err.message : 'Failed to delete session';
      setError(message);
      console.error('[useSessions] Error deleting:', err);
    }
  }, [sessions, getAuthHeaders, activeSessionId, onSessionChange]);

  // ===========================================================================
  // RETURN
  // ===========================================================================

  return {
    // State
    sessions,
    activeSession,
    isLoading,
    error,

    // Actions
    createSession,
    selectSession,
    updateSession,
    deleteSession,
    refreshSessions,

    // Computed
    groupedSessions,
  };
}
