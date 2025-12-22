/**
 * IndexedDB Shim Script for Safari Private Browsing Mode
 *
 * Safari's Private Browsing mode restricts IndexedDB access, causing libraries
 * like `idb-keyval` (used by wallet connectors) to crash when `request.result`
 * is undefined in the `onupgradeneeded` handler.
 *
 * This script wraps `indexedDB.open()` to:
 * 1. Detect when IndexedDB operations will fail (e.g., in Private Browsing)
 * 2. Provide an in-memory fallback that mimics the IndexedDB API
 * 3. Prevent "undefined is not an object (evaluating 'n.result.createObjectStore')"
 *
 * The shim is transparent - if IndexedDB works normally, no intervention occurs.
 * Only when IndexedDB fails does it switch to the in-memory fallback.
 *
 * This MUST run before any wallet connectors or libraries that use IndexedDB.
 */
export const INDEXEDDB_SHIM_SCRIPT = `
(function() {
  'use strict';

  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
    return;
  }

  // Track if we've already detected IndexedDB is unavailable
  var indexedDBUnavailable = false;
  var hasLoggedFallback = false;

  // In-memory storage for the shim
  var memoryStores = {};

  // Test if IndexedDB is actually usable
  function testIndexedDB() {
    return new Promise(function(resolve) {
      try {
        var testName = '__gatewayz_idb_test__' + Date.now();
        var request = indexedDB.open(testName, 1);
        var timeoutId = setTimeout(function() {
          resolve(false);
        }, 1000);

        request.onerror = function() {
          clearTimeout(timeoutId);
          resolve(false);
        };

        request.onsuccess = function() {
          clearTimeout(timeoutId);
          try {
            request.result.close();
            indexedDB.deleteDatabase(testName);
            resolve(true);
          } catch (e) {
            resolve(false);
          }
        };

        request.onupgradeneeded = function(event) {
          try {
            var db = event.target.result;
            if (!db) {
              clearTimeout(timeoutId);
              resolve(false);
              return;
            }
            // Try to create a test object store
            db.createObjectStore('test');
          } catch (e) {
            clearTimeout(timeoutId);
            resolve(false);
          }
        };
      } catch (e) {
        resolve(false);
      }
    });
  }

  // Create a mock IDBDatabase
  function createMockDatabase(name) {
    if (!memoryStores[name]) {
      memoryStores[name] = {};
    }

    var mockObjectStore = function(storeName, mode) {
      if (!memoryStores[name][storeName]) {
        memoryStores[name][storeName] = new Map();
      }
      var store = memoryStores[name][storeName];

      return {
        name: storeName,
        keyPath: null,
        indexNames: { length: 0, contains: function() { return false; }, item: function() { return null; } },
        autoIncrement: false,
        transaction: { mode: mode || 'readonly' },
        put: function(value, key) {
          return createMockRequest(function() {
            store.set(key, value);
            return key;
          });
        },
        get: function(key) {
          return createMockRequest(function() {
            return store.get(key);
          });
        },
        delete: function(key) {
          return createMockRequest(function() {
            store.delete(key);
            return undefined;
          });
        },
        clear: function() {
          return createMockRequest(function() {
            store.clear();
            return undefined;
          });
        },
        getAll: function() {
          return createMockRequest(function() {
            return Array.from(store.values());
          });
        },
        getAllKeys: function() {
          return createMockRequest(function() {
            return Array.from(store.keys());
          });
        },
        count: function() {
          return createMockRequest(function() {
            return store.size;
          });
        },
        add: function(value, key) {
          return createMockRequest(function() {
            if (store.has(key)) {
              throw new DOMException('Key already exists', 'ConstraintError');
            }
            store.set(key, value);
            return key;
          });
        },
        index: function() {
          return this;
        },
        createIndex: function() {
          return {};
        },
        deleteIndex: function() {}
      };
    };

    var mockTransaction = function(storeNames, mode) {
      var storeNameArray = Array.isArray(storeNames) ? storeNames : [storeNames];
      return {
        mode: mode || 'readonly',
        db: mockDb,
        objectStoreNames: storeNameArray,
        objectStore: function(name) {
          return mockObjectStore(name, mode);
        },
        oncomplete: null,
        onerror: null,
        onabort: null,
        abort: function() {},
        commit: function() {}
      };
    };

    var objectStoreNames = {
      length: 0,
      _names: [],
      contains: function(name) {
        return this._names.indexOf(name) !== -1;
      },
      item: function(index) {
        return this._names[index] || null;
      }
    };

    var mockDb = {
      name: name,
      version: 1,
      objectStoreNames: objectStoreNames,
      transaction: mockTransaction,
      createObjectStore: function(storeName, options) {
        if (!memoryStores[name][storeName]) {
          memoryStores[name][storeName] = new Map();
        }
        objectStoreNames._names.push(storeName);
        objectStoreNames.length = objectStoreNames._names.length;
        return mockObjectStore(storeName, 'readwrite');
      },
      deleteObjectStore: function(storeName) {
        delete memoryStores[name][storeName];
        var idx = objectStoreNames._names.indexOf(storeName);
        if (idx !== -1) {
          objectStoreNames._names.splice(idx, 1);
          objectStoreNames.length = objectStoreNames._names.length;
        }
      },
      close: function() {},
      onclose: null,
      onerror: null,
      onabort: null,
      onversionchange: null
    };

    return mockDb;
  }

  // Create a mock IDBRequest
  function createMockRequest(executor) {
    var request = {
      result: undefined,
      error: null,
      source: null,
      transaction: null,
      readyState: 'pending',
      onsuccess: null,
      onerror: null
    };

    // Execute asynchronously to mimic real IndexedDB behavior
    setTimeout(function() {
      try {
        request.result = executor();
        request.readyState = 'done';
        if (typeof request.onsuccess === 'function') {
          request.onsuccess({ target: request });
        }
      } catch (e) {
        request.error = e;
        request.readyState = 'done';
        if (typeof request.onerror === 'function') {
          request.onerror({ target: request });
        }
      }
    }, 0);

    return request;
  }

  // Create a mock IDBOpenDBRequest
  function createMockOpenRequest(name, version) {
    var mockDb = createMockDatabase(name);
    
    var request = {
      result: mockDb,
      error: null,
      source: null,
      transaction: null,
      readyState: 'pending',
      onsuccess: null,
      onerror: null,
      onupgradeneeded: null,
      onblocked: null
    };

    // Execute asynchronously
    setTimeout(function() {
      try {
        request.readyState = 'done';
        
        // Always call onupgradeneeded for new databases in memory mode
        if (typeof request.onupgradeneeded === 'function') {
          request.onupgradeneeded({
            target: request,
            oldVersion: 0,
            newVersion: version || 1
          });
        }
        
        if (typeof request.onsuccess === 'function') {
          request.onsuccess({ target: request });
        }
      } catch (e) {
        request.error = e;
        if (typeof request.onerror === 'function') {
          request.onerror({ target: request });
        }
      }
    }, 0);

    return request;
  }

  // Store the original indexedDB methods
  var originalOpen = indexedDB.open.bind(indexedDB);
  var originalDeleteDatabase = indexedDB.deleteDatabase.bind(indexedDB);

  // Create shim for indexedDB.open
  function shimmedOpen(name, version) {
    // If we've already determined IndexedDB is unavailable, use memory immediately
    if (indexedDBUnavailable) {
      if (!hasLoggedFallback) {
        hasLoggedFallback = true;
        console.warn('[Gatewayz] Using in-memory IndexedDB fallback (storage restricted)');
      }
      return createMockOpenRequest(name, version);
    }

    // Try the real IndexedDB first
    var realRequest;
    try {
      realRequest = originalOpen(name, version);
    } catch (e) {
      // IndexedDB.open() itself threw - use fallback
      indexedDBUnavailable = true;
      if (!hasLoggedFallback) {
        hasLoggedFallback = true;
        console.warn('[Gatewayz] Using in-memory IndexedDB fallback (open failed):', e.message);
      }
      return createMockOpenRequest(name, version);
    }

    // Wrap the real request to catch failures
    var wrappedRequest = {
      get result() { return realRequest.result; },
      get error() { return realRequest.error; },
      get source() { return realRequest.source; },
      get transaction() { return realRequest.transaction; },
      get readyState() { return realRequest.readyState; },
      _onsuccess: null,
      _onerror: null,
      _onupgradeneeded: null,
      _onblocked: null
    };

    Object.defineProperty(wrappedRequest, 'onsuccess', {
      get: function() { return this._onsuccess; },
      set: function(fn) {
        this._onsuccess = fn;
        realRequest.onsuccess = fn;
      }
    });

    Object.defineProperty(wrappedRequest, 'onerror', {
      get: function() { return this._onerror; },
      set: function(fn) {
        this._onerror = function(event) {
          // If the error indicates storage is restricted, switch to fallback
          indexedDBUnavailable = true;
          if (!hasLoggedFallback) {
            hasLoggedFallback = true;
            console.warn('[Gatewayz] Using in-memory IndexedDB fallback (error during open)');
          }
          // Create fallback and call the callbacks
          var mockRequest = createMockOpenRequest(name, version);
          if (wrappedRequest._onupgradeneeded) {
            mockRequest.onupgradeneeded = wrappedRequest._onupgradeneeded;
          }
          if (wrappedRequest._onsuccess) {
            mockRequest.onsuccess = wrappedRequest._onsuccess;
          }
        };
        realRequest.onerror = this._onerror;
      }
    });

    Object.defineProperty(wrappedRequest, 'onupgradeneeded', {
      get: function() { return this._onupgradeneeded; },
      set: function(fn) {
        this._onupgradeneeded = fn;
        realRequest.onupgradeneeded = function(event) {
          // Check if result is valid before calling the handler
          if (!event.target || !event.target.result) {
            // Safari Private Browsing - result is undefined
            indexedDBUnavailable = true;
            if (!hasLoggedFallback) {
              hasLoggedFallback = true;
              console.warn('[Gatewayz] Using in-memory IndexedDB fallback (result undefined in onupgradeneeded)');
            }
            // Create mock request and call handlers
            var mockRequest = createMockOpenRequest(name, version);
            if (fn) {
              mockRequest.onupgradeneeded = fn;
            }
            if (wrappedRequest._onsuccess) {
              mockRequest.onsuccess = wrappedRequest._onsuccess;
            }
            return;
          }
          // Result is valid, call the original handler
          if (typeof fn === 'function') {
            fn.call(realRequest, event);
          }
        };
      }
    });

    Object.defineProperty(wrappedRequest, 'onblocked', {
      get: function() { return this._onblocked; },
      set: function(fn) {
        this._onblocked = fn;
        realRequest.onblocked = fn;
      }
    });

    // Handle abort
    realRequest.onabort = function() {
      indexedDBUnavailable = true;
      if (!hasLoggedFallback) {
        hasLoggedFallback = true;
        console.warn('[Gatewayz] Using in-memory IndexedDB fallback (request aborted)');
      }
    };

    return wrappedRequest;
  }

  // Create shim for indexedDB.deleteDatabase
  function shimmedDeleteDatabase(name) {
    if (indexedDBUnavailable) {
      // Just clear the memory store
      delete memoryStores[name];
      return createMockRequest(function() { return undefined; });
    }
    
    try {
      return originalDeleteDatabase(name);
    } catch (e) {
      delete memoryStores[name];
      return createMockRequest(function() { return undefined; });
    }
  }

  // Apply the shim
  try {
    // Test IndexedDB availability proactively on page load
    testIndexedDB().then(function(available) {
      if (!available) {
        indexedDBUnavailable = true;
        if (!hasLoggedFallback) {
          hasLoggedFallback = true;
          console.warn('[Gatewayz] IndexedDB not available - using in-memory fallback');
        }
      }
    });

    // Override indexedDB methods
    Object.defineProperty(indexedDB, 'open', {
      value: shimmedOpen,
      writable: true,
      configurable: true
    });

    Object.defineProperty(indexedDB, 'deleteDatabase', {
      value: shimmedDeleteDatabase,
      writable: true,
      configurable: true
    });
  } catch (e) {
    // If we can't override, at least add error handlers
    console.warn('[Gatewayz] Could not install IndexedDB shim:', e.message);
  }
})();
`;
