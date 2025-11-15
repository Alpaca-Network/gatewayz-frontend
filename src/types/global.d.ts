/**
 * Global type definitions for window properties
 * Used for tracking analytics and feature availability
 */

declare global {
  interface Window {
    /**
     * Flag to track if Statsig analytics is available
     * Set to false if ad blocker or network issues prevent initialization
     * Set to true if Statsig initialized successfully
     */
    statsigAvailable?: boolean;
  }
}

export {};
