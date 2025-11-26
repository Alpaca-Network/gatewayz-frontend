/**
 * Auth State Machine
 *
 * A formal state machine for authentication that:
 * - Defines explicit state transitions
 * - Prevents race conditions with atomic transitions
 * - Provides a single source of truth for auth state
 * - Emits events for state changes
 */

import {
  AuthState,
  AuthEvent,
  AuthenticatedUser,
  AuthError,
  AuthMachineContext,
  AuthMachineConfig,
} from './types';

// =============================================================================
// STATE TRANSITION MAP
// =============================================================================

/**
 * Valid state transitions.
 * Each state maps to the events it can handle and the resulting state.
 */
type TransitionMap = {
  [S in AuthState]: {
    [E in AuthEvent['type']]?: AuthState;
  };
};

const TRANSITIONS: TransitionMap = {
  idle: {
    LOGIN_START: 'authenticating',
    SESSION_RESTORED: 'authenticated',
    SESSION_INVALID: 'unauthenticated',
    RESET: 'idle',
  },
  unauthenticated: {
    LOGIN_START: 'authenticating',
    SESSION_RESTORED: 'authenticated',
    RESET: 'idle',
  },
  authenticating: {
    PRIVY_SUCCESS: 'syncing',
    PRIVY_ERROR: 'error',
    LOGOUT: 'unauthenticated',
    RESET: 'idle',
  },
  syncing: {
    SYNC_SUCCESS: 'authenticated',
    SYNC_ERROR: 'error',
    LOGOUT: 'unauthenticated',
    RESET: 'idle',
  },
  authenticated: {
    LOGOUT: 'unauthenticated',
    REFRESH_START: 'refreshing',
    SESSION_INVALID: 'unauthenticated',
    RESET: 'idle',
  },
  error: {
    LOGIN_START: 'authenticating',
    LOGOUT: 'unauthenticated',
    RESET: 'idle',
  },
  refreshing: {
    REFRESH_SUCCESS: 'authenticated',
    REFRESH_ERROR: 'error',
    LOGOUT: 'unauthenticated',
    RESET: 'idle',
  },
};

// =============================================================================
// AUTH STATE MACHINE CLASS
// =============================================================================

export class AuthMachine {
  private _state: AuthState = 'idle';
  private _context: AuthMachineContext = {
    user: null,
    error: null,
    retryCount: 0,
    lastSyncAttempt: null,
  };
  private _config: AuthMachineConfig;
  private _transitionLock = false;
  private _listeners: Set<(state: AuthState, context: AuthMachineContext) => void> = new Set();

  constructor(config: AuthMachineConfig = {}) {
    this._config = config;
  }

  // ===========================================================================
  // PUBLIC GETTERS
  // ===========================================================================

  get state(): AuthState {
    return this._state;
  }

  get context(): Readonly<AuthMachineContext> {
    return { ...this._context };
  }

  get user(): AuthenticatedUser | null {
    return this._context.user;
  }

  get error(): AuthError | null {
    return this._context.error;
  }

  get isAuthenticated(): boolean {
    return this._state === 'authenticated';
  }

  get isLoading(): boolean {
    return ['idle', 'authenticating', 'syncing', 'refreshing'].includes(this._state);
  }

  // ===========================================================================
  // STATE TRANSITIONS
  // ===========================================================================

  /**
   * Process an event and transition to a new state if valid.
   * Returns true if transition occurred, false if invalid.
   */
  send(event: AuthEvent): boolean {
    // Prevent concurrent transitions
    if (this._transitionLock) {
      console.warn('[AuthMachine] Transition already in progress, ignoring event:', event.type);
      return false;
    }

    const currentState = this._state;
    const validTransitions = TRANSITIONS[currentState];
    const nextState = validTransitions[event.type];

    if (!nextState) {
      console.warn(
        `[AuthMachine] Invalid transition: ${currentState} + ${event.type}. ` +
        `Valid events: ${Object.keys(validTransitions).join(', ')}`
      );
      return false;
    }

    // Lock transitions during processing
    this._transitionLock = true;

    try {
      // Update context based on event
      this._updateContext(event);

      // Perform state transition
      const previousState = this._state;
      this._state = nextState;

      console.log(`[AuthMachine] ${previousState} -> ${nextState} (${event.type})`);

      // Notify listeners
      this._notifyListeners();

      // Call config callbacks
      this._handleCallbacks(event);

      return true;
    } finally {
      this._transitionLock = false;
    }
  }

  /**
   * Subscribe to state changes.
   * Returns unsubscribe function.
   */
  subscribe(listener: (state: AuthState, context: AuthMachineContext) => void): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  /**
   * Reset the machine to initial state.
   * Clears all context and resets to idle.
   */
  reset(): void {
    this._context = {
      user: null,
      error: null,
      retryCount: 0,
      lastSyncAttempt: null,
    };
    this._state = 'idle';
    this._transitionLock = false;
    this._notifyListeners();
  }

  // ===========================================================================
  // CONTEXT UPDATES
  // ===========================================================================

  private _updateContext(event: AuthEvent): void {
    switch (event.type) {
      case 'LOGIN_START':
        this._context.error = null;
        this._context.retryCount = 0;
        break;

      case 'PRIVY_SUCCESS':
        // Privy succeeded, prepare for sync
        this._context.lastSyncAttempt = Date.now();
        break;

      case 'PRIVY_ERROR':
        this._context.error = {
          code: 'INVALID_TOKEN',
          message: event.error.message || 'Privy authentication failed',
          timestamp: Date.now(),
        };
        break;

      case 'SYNC_SUCCESS':
      case 'REFRESH_SUCCESS':
      case 'SESSION_RESTORED':
        this._context.user = event.user;
        this._context.error = null;
        this._context.retryCount = 0;
        break;

      case 'SYNC_ERROR':
      case 'REFRESH_ERROR':
        this._context.error = event.error;
        this._context.retryCount++;
        break;

      case 'LOGOUT':
      case 'SESSION_INVALID':
        this._context.user = null;
        this._context.error = null;
        this._context.retryCount = 0;
        break;

      case 'RESET':
        this._context = {
          user: null,
          error: null,
          retryCount: 0,
          lastSyncAttempt: null,
        };
        break;

      case 'REFRESH_START':
        // Keep user data during refresh
        break;
    }
  }

  private _notifyListeners(): void {
    const state = this._state;
    const context = this.context;

    this._listeners.forEach(listener => {
      try {
        listener(state, context);
      } catch (error) {
        console.error('[AuthMachine] Listener error:', error);
      }
    });

    // Also call config callback
    this._config.onStateChange?.(state, context);
  }

  private _handleCallbacks(event: AuthEvent): void {
    switch (event.type) {
      case 'SYNC_SUCCESS':
      case 'REFRESH_SUCCESS':
      case 'SESSION_RESTORED':
        this._config.onAuthenticated?.(event.user);
        break;

      case 'LOGOUT':
        this._config.onLogout?.();
        break;

      case 'SYNC_ERROR':
      case 'REFRESH_ERROR':
      case 'PRIVY_ERROR':
        if (this._context.error) {
          this._config.onError?.(this._context.error);
        }
        break;
    }
  }

  // ===========================================================================
  // HELPER METHODS
  // ===========================================================================

  /**
   * Check if a transition is valid from current state.
   */
  canSend(eventType: AuthEvent['type']): boolean {
    const validTransitions = TRANSITIONS[this._state];
    return eventType in validTransitions;
  }

  /**
   * Get all valid events for current state.
   */
  getValidEvents(): AuthEvent['type'][] {
    return Object.keys(TRANSITIONS[this._state]) as AuthEvent['type'][];
  }

  /**
   * Check if error is retryable based on retry count and error type.
   */
  isRetryable(): boolean {
    if (this._state !== 'error' || !this._context.error) {
      return false;
    }

    const { error, retryCount } = this._context;

    // Max retries exceeded
    if (retryCount >= 3) {
      return false;
    }

    // Only certain error types are retryable
    const retryableErrors = ['NETWORK_ERROR', 'TIMEOUT', 'BACKEND_ERROR'];
    return retryableErrors.includes(error.code);
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let machineInstance: AuthMachine | null = null;

/**
 * Get or create the singleton auth machine instance.
 */
export function getAuthMachine(config?: AuthMachineConfig): AuthMachine {
  if (!machineInstance) {
    machineInstance = new AuthMachine(config);
  }
  return machineInstance;
}

/**
 * Reset the singleton instance (useful for testing).
 */
export function resetAuthMachine(): void {
  machineInstance?.reset();
  machineInstance = null;
}
