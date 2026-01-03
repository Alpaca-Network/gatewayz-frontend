/**
 * Early error suppressor script for ethereum property conflicts and IndexedDB errors.
 *
 * This script must run BEFORE any wallet extensions (like evmAsk.js) attempt
 * to define window.ethereum. Wallet extensions often try to use Object.defineProperty
 * on window.ethereum, and if another extension has already defined it as non-configurable,
 * this causes "Cannot redefine property: ethereum" errors.
 *
 * This script also handles IndexedDB errors that can occur when:
 * - User clears browser data (especially on Mobile Safari)
 * - Private browsing mode limitations
 * - The Privy SDK tries to access a deleted database
 *
 * This script:
 * 1. Sets up early error handlers to catch these errors before React mounts
 * 2. Suppresses console errors from wallet extensions
 * 3. Catches IndexedDB "Database deleted by request of the user" errors
 *
 * Note: This is complementary to the ErrorSuppressor React component, which handles
 * errors after React has mounted.
 */
export const ETHEREUM_ERROR_SUPPRESSOR_SCRIPT = `
(function() {
  'use strict';

  // Patterns for errors to suppress (ethereum/wallet extension errors)
  var suppressPatterns = [
    /Cannot redefine property.*ethereum/i,
    /evmAsk.*ethereum/i,
    /Cannot redefine property: ethereum/i
  ];

  // Patterns for IndexedDB errors to handle gracefully
  var indexedDBErrorPatterns = [
    /Database deleted by request of the user/i,
    /UnknownError.*Database/i,
    /The database connection is closing/i,
    /VersionError/i,
    /InvalidStateError.*IndexedDB/i,
    /AbortError.*IndexedDB/i,
    /QuotaExceededError/i,
    /The operation failed for reasons unrelated to the database/i
  ];

  // Check if error message matches any suppress pattern
  function shouldSuppress(message) {
    if (!message) return false;
    for (var i = 0; i < suppressPatterns.length; i++) {
      if (suppressPatterns[i].test(message)) {
        return true;
      }
    }
    return false;
  }

  // Check if error is an IndexedDB error
  function isIndexedDBError(message, errorName) {
    if (!message) return false;
    
    // Check for UnknownError with database context
    if (errorName === 'UnknownError' && message.toLowerCase().indexOf('database') !== -1) {
      return true;
    }
    
    // Check message against known IndexedDB error patterns
    for (var i = 0; i < indexedDBErrorPatterns.length; i++) {
      if (indexedDBErrorPatterns[i].test(message)) {
        return true;
      }
    }
    return false;
  }

  // Early global error handler - catches errors before React mounts
  window.addEventListener('error', function(event) {
    var message = event.message || '';
    var filename = event.filename || '';
    var errorName = event.error && event.error.name ? event.error.name : '';

    // Suppress ethereum property redefinition errors
    if (shouldSuppress(message)) {
      event.preventDefault();
      event.stopPropagation();
      return true;
    }

    // Suppress any errors from evmAsk.js (wallet extension script)
    if (filename.indexOf('evmAsk') !== -1) {
      event.preventDefault();
      event.stopPropagation();
      return true;
    }

    // Handle IndexedDB errors gracefully (e.g., "Database deleted by request of the user")
    // These occur when user clears browser data, especially on Mobile Safari
    if (isIndexedDBError(message, errorName)) {
      console.warn('[Gatewayz] IndexedDB error detected (non-blocking):', message);
      event.preventDefault();
      event.stopPropagation();
      return true;
    }

    return false;
  }, true); // Use capture phase to catch errors early

  // Early unhandledrejection handler for Promise-based IndexedDB errors
  window.addEventListener('unhandledrejection', function(event) {
    var reason = event.reason;
    var message = '';
    var errorName = '';
    
    try {
      if (reason) {
        message = reason.message || String(reason);
        errorName = reason.name || '';
      }
    } catch (e) {
      return;
    }

    // Handle IndexedDB errors gracefully
    if (isIndexedDBError(message, errorName)) {
      console.warn('[Gatewayz] IndexedDB error detected in Promise (non-blocking):', message);
      event.preventDefault();
      return;
    }
  }, true); // Use capture phase to catch errors early

  // Override console.error to suppress wallet extension errors
  var originalError = console.error;
  console.error = function() {
    var message = Array.prototype.join.call(arguments, ' ');
    if (!shouldSuppress(message)) {
      originalError.apply(console, arguments);
    }
  };
})();
`;
