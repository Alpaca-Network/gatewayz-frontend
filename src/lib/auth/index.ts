/**
 * Auth Module
 *
 * Centralized authentication system with:
 * - State machine for predictable state transitions
 * - Centralized configuration for timeouts and retries
 * - Service layer for backend communication
 * - Type-safe error handling
 */

// Types
export * from './types';

// Configuration
export * from './auth-config';

// State Machine
export { AuthMachine, getAuthMachine, resetAuthMachine } from './auth-machine';

// Service
export {
  AuthService,
  authService,
  getApiKey,
  saveApiKey,
  getUserData,
  saveUserData,
  clearAuthData,
  getReferralCode,
} from './auth-service';
