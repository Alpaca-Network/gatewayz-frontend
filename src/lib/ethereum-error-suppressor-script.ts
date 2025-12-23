/**
 * Early error suppressor script for ethereum property conflicts and DOM errors.
 *
 * This script must run BEFORE any wallet extensions (like evmAsk.js) attempt
 * to define window.ethereum. Wallet extensions often try to use Object.defineProperty
 * on window.ethereum, and if another extension has already defined it as non-configurable,
 * this causes "Cannot redefine property: ethereum" errors.
 *
 * This script also suppresses React Portal cleanup errors (NotFoundError: removeChild)
 * which occur when browser extensions (like Google Translate) modify the DOM structure
 * and React's cleanup logic fails during navigation.
 *
 * This script:
 * 1. Sets up early error handlers to catch these errors before React mounts
 * 2. Suppresses console errors from wallet extensions
 * 3. Suppresses React Portal cleanup errors from DOM modifications
 *
 * Note: This is complementary to the ErrorSuppressor React component, which handles
 * errors after React has mounted.
 */
export const ETHEREUM_ERROR_SUPPRESSOR_SCRIPT = `
(function() {
  'use strict';

  // Patterns for errors to suppress
  var suppressPatterns = [
    /Cannot redefine property.*ethereum/i,
    /evmAsk.*ethereum/i,
    /Cannot redefine property: ethereum/i,
    /Failed to execute 'removeChild' on 'Node'/i,
    /The node to be removed is not a child of this node/i,
    /NotFoundError.*removeChild/i
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

  // Early global error handler - catches errors before React mounts
  window.addEventListener('error', function(event) {
    var message = event.message || '';
    var filename = event.filename || '';

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

    // Suppress NotFoundError (React Portal cleanup errors)
    // This occurs when browser extensions modify DOM and React cleanup fails
    if (event.error && event.error.name === 'NotFoundError') {
      event.preventDefault();
      event.stopPropagation();
      return true;
    }

    return false;
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
