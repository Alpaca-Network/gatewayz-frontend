/**
 * IndexedDB shim script for restricted browser environments.
 *
 * This script provides a minimal IndexedDB polyfill for environments where
 * indexedDB is not available (e.g., Facebook iOS in-app browser, some privacy
 * modes). Without this shim, WalletConnect's idb-keyval dependency throws a
 * "ReferenceError: Can't find variable: indexedDB" error.
 *
 * The shim creates a no-op IndexedDB implementation that:
 * 1. Prevents the ReferenceError from occurring
 * 2. Returns proper IDB request objects with error states
 * 3. Allows WalletConnect to fail gracefully instead of crashing
 *
 * This script must run BEFORE any code attempts to use indexedDB (specifically
 * before Privy/WalletConnect initializes).
 */
export const INDEXEDDB_SHIM_SCRIPT = `
(function() {
  'use strict';

  // Skip if indexedDB is already available
  if (typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined') {
    return;
  }

  // Skip if not in a browser environment
  if (typeof window === 'undefined') {
    return;
  }

  // Log for debugging
  if (typeof console !== 'undefined' && console.warn) {
    console.warn('[Gatewayz] IndexedDB not available - using shim to prevent crashes');
  }

  /**
   * Create a minimal IDBRequest-like object that errors appropriately
   */
  function createFailedRequest(errorMessage) {
    var request = {
      result: null,
      error: new DOMException(errorMessage, 'NotSupportedError'),
      source: null,
      transaction: null,
      readyState: 'done',
      onsuccess: null,
      onerror: null,
      onblocked: null,
      onupgradeneeded: null,
      addEventListener: function(type, callback) {
        if (type === 'error' && typeof callback === 'function') {
          // Call error handler asynchronously
          setTimeout(function() {
            try {
              callback({ target: request, type: 'error' });
            } catch (e) {
              // Ignore handler errors
            }
          }, 0);
        }
      },
      removeEventListener: function() {},
      dispatchEvent: function() { return false; }
    };

    // Trigger onerror asynchronously if set
    setTimeout(function() {
      if (typeof request.onerror === 'function') {
        try {
          request.onerror({ target: request, type: 'error' });
        } catch (e) {
          // Ignore handler errors
        }
      }
    }, 0);

    return request;
  }

  /**
   * Create a minimal IDBFactory shim
   */
  var indexedDBShim = {
    open: function(name, version) {
      return createFailedRequest('IndexedDB is not available in this browser environment');
    },
    deleteDatabase: function(name) {
      return createFailedRequest('IndexedDB is not available in this browser environment');
    },
    cmp: function(a, b) {
      // Basic comparison
      if (a < b) return -1;
      if (a > b) return 1;
      return 0;
    },
    databases: function() {
      // Return empty promise
      return Promise.resolve([]);
    }
  };

  // Define indexedDB on window
  try {
    Object.defineProperty(window, 'indexedDB', {
      value: indexedDBShim,
      writable: false,
      configurable: true,
      enumerable: true
    });
  } catch (e) {
    // If defineProperty fails, try direct assignment
    try {
      window.indexedDB = indexedDBShim;
    } catch (e2) {
      // Last resort - log and continue
      if (typeof console !== 'undefined' && console.error) {
        console.error('[Gatewayz] Failed to install IndexedDB shim:', e2);
      }
    }
  }

  // Also define mozIndexedDB, webkitIndexedDB, msIndexedDB for older browser compatibility
  var aliases = ['mozIndexedDB', 'webkitIndexedDB', 'msIndexedDB'];
  for (var i = 0; i < aliases.length; i++) {
    var alias = aliases[i];
    if (typeof window[alias] === 'undefined') {
      try {
        window[alias] = indexedDBShim;
      } catch (e) {
        // Ignore - these are optional
      }
    }
  }
})();
`;
