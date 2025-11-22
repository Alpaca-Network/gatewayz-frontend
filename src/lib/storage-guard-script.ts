export const STORAGE_GUARD_SCRIPT = `
(function () {
  if (typeof window === 'undefined') {
    return;
  }

  var STORAGE_TEST_KEY = '__gatewayz_storage_test__';

  function createFallbackStorage(name) {
    var store = new Map();

    return {
      get length() {
        return store.size;
      },
      clear: function () {
        store.clear();
      },
      getItem: function (key) {
        var value = store.get(String(key));
        return value === undefined ? null : value;
      },
      key: function (index) {
        var keys = Array.from(store.keys());
        return typeof index === 'number' && index >= 0 && index < keys.length
          ? keys[index]
          : null;
      },
      removeItem: function (key) {
        store.delete(String(key));
      },
      setItem: function (key, value) {
        store.set(String(key), String(value));
      },
    };
  }

  function wrapStorage(name) {
    try {
      var descriptor = Object.getOwnPropertyDescriptor(window, name);
      if (!descriptor || typeof descriptor.get !== 'function') {
        return;
      }

      var originalGet = descriptor.get;
      var validatedStorage = null;
      var fallbackStorage = null;
      var hasWarned = false;

      Object.defineProperty(window, name, {
        configurable: true,
        enumerable: typeof descriptor.enumerable === 'boolean' ? descriptor.enumerable : true,
        get: function () {
          if (validatedStorage) {
            return validatedStorage;
          }
          if (fallbackStorage) {
            return fallbackStorage;
          }

          try {
            var storage = originalGet.call(window);
            storage.setItem(STORAGE_TEST_KEY, '1');
            storage.removeItem(STORAGE_TEST_KEY);
            validatedStorage = storage;
            return storage;
          } catch (error) {
            fallbackStorage = createFallbackStorage(name);
            if (!hasWarned && typeof console !== 'undefined') {
              hasWarned = true;
              console.warn(
                '[Gatewayz] Falling back to in-memory ' +
                  name +
                  ' because access was blocked.',
                error
              );
            }
            return fallbackStorage;
          }
        },
      });
    } catch (error) {
      if (typeof console !== 'undefined') {
        console.warn('[Gatewayz] Unable to wrap ' + name + ' for safe access.', error);
      }
    }
  }

  // Only guard localStorage. Wrapping sessionStorage interferes with providers
  // like Privy that depend on the native Storage object during initialization.
  wrapStorage('localStorage');
})();
`;
