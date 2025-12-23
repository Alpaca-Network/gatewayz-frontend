/**
 * Early storage shim script that MUST run BEFORE any JavaScript modules load.
 *
 * This script protects against SecurityError when localStorage/sessionStorage
 * are accessed in restricted environments (e.g., iOS Safari Private Mode).
 *
 * The issue: WalletConnect and other modules access localStorage synchronously
 * during webpack module initialization, which throws SecurityError in private
 * browsing modes BEFORE any React components can mount protective shims.
 *
 * Solution: This script runs as a native <script> in <head>, which executes
 * synchronously during SSR/hydration, BEFORE any bundled JavaScript loads.
 * It wraps the localStorage/sessionStorage getters to catch SecurityError
 * and return an in-memory fallback instead of throwing.
 *
 * IMPORTANT: This script uses ES5 syntax only (no arrow functions, const/let,
 * template literals, etc.) to ensure maximum browser compatibility.
 */
export const EARLY_STORAGE_SHIM_SCRIPT = `
(function() {
  'use strict';

  if (typeof window === 'undefined') {
    return;
  }

  var STORAGE_TEST_KEY = '__gatewayz_storage_test__';
  var hasWarned = {};

  // Create an in-memory storage fallback that implements the Storage interface
  function createFallbackStorage(name) {
    var store = {};
    var keys = [];

    function updateKeys() {
      keys = Object.keys(store);
    }

    return {
      get length() {
        return keys.length;
      },
      clear: function() {
        store = {};
        keys = [];
      },
      getItem: function(key) {
        var k = String(key);
        return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null;
      },
      key: function(index) {
        return typeof index === 'number' && index >= 0 && index < keys.length
          ? keys[index]
          : null;
      },
      removeItem: function(key) {
        var k = String(key);
        if (Object.prototype.hasOwnProperty.call(store, k)) {
          delete store[k];
          updateKeys();
        }
      },
      setItem: function(key, value) {
        var k = String(key);
        store[k] = String(value);
        updateKeys();
      }
    };
  }

  // Wrap a storage property (localStorage or sessionStorage) with safe access
  function wrapStorage(name) {
    var fallbackStorage = null;
    var validatedStorage = null;

    try {
      var descriptor = Object.getOwnPropertyDescriptor(window, name);

      // If no descriptor or not a getter, try direct access protection
      if (!descriptor || typeof descriptor.get !== 'function') {
        // Some browsers expose storage as a value, not a getter
        // Try to test it directly
        try {
          var directStorage = window[name];
          if (directStorage) {
            directStorage.setItem(STORAGE_TEST_KEY, '1');
            directStorage.removeItem(STORAGE_TEST_KEY);
            // Storage works, no need to shim
            return;
          }
        } catch (e) {
          // Storage access failed, create fallback
          fallbackStorage = createFallbackStorage(name);
          try {
            Object.defineProperty(window, name, {
              configurable: true,
              enumerable: true,
              get: function() {
                return fallbackStorage;
              }
            });
            if (!hasWarned[name]) {
              hasWarned[name] = true;
              if (typeof console !== 'undefined' && console.warn) {
                console.warn('[Gatewayz] ' + name + ' is blocked, using in-memory fallback.');
              }
            }
          } catch (defineError) {
            // Cannot redefine, storage access will fail
            if (typeof console !== 'undefined' && console.warn) {
              console.warn('[Gatewayz] Cannot protect ' + name + ':', defineError);
            }
          }
        }
        return;
      }

      // Storage is exposed as a getter, wrap it
      var originalGet = descriptor.get;

      Object.defineProperty(window, name, {
        configurable: true,
        enumerable: descriptor.enumerable !== false,
        get: function() {
          // Return cached validated storage if available
          if (validatedStorage) {
            return validatedStorage;
          }

          // Return cached fallback if we already know storage is blocked
          if (fallbackStorage) {
            return fallbackStorage;
          }

          // Try to access and validate the original storage
          try {
            var storage = originalGet.call(window);
            // Test that we can actually use it
            storage.setItem(STORAGE_TEST_KEY, '1');
            storage.removeItem(STORAGE_TEST_KEY);
            // Storage works, cache and return it
            validatedStorage = storage;
            return storage;
          } catch (error) {
            // Storage access failed (SecurityError in private mode)
            // Create and return in-memory fallback
            fallbackStorage = createFallbackStorage(name);
            if (!hasWarned[name]) {
              hasWarned[name] = true;
              if (typeof console !== 'undefined' && console.warn) {
                console.warn(
                  '[Gatewayz] ' + name + ' access blocked (private browsing?), using in-memory fallback.',
                  error
                );
              }
            }
            return fallbackStorage;
          }
        }
      });
    } catch (error) {
      // Failed to wrap storage (shouldn't happen, but be defensive)
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[Gatewayz] Failed to protect ' + name + ':', error);
      }
    }
  }

  // Wrap both localStorage and sessionStorage
  // WalletConnect specifically accesses localStorage, but sessionStorage
  // may also be accessed by other modules (like Privy session handling)
  wrapStorage('localStorage');
  wrapStorage('sessionStorage');
})();
`;
