import Script from "next/script";

/**
 * Injects a script that guarantees `localStorage` and `sessionStorage`
 * are always readable. Some privacy modes throw a `SecurityError`
 * when touching these properties during early module evaluation
 * (before our React tree can guard access). We detect that scenario
 * and replace the storages with in-memory fallbacks so third-party
 * SDKs (Privy, WalletConnect, etc.) don't crash the app.
 */
export function SafeStorageShim() {
  return (
    <Script id="safe-storage-shim" strategy="beforeInteractive">
      {`
      (function () {
        if (typeof window === "undefined") {
          return;
        }

        var patchKey = "__gatewayz_storage_patch__";
        if (window[patchKey]) {
          return;
        }
        window[patchKey] = true;

        function createMemoryStorage() {
          var store = Object.create(null);
          return {
            get length() {
              return Object.keys(store).length;
            },
            clear: function () {
              store = Object.create(null);
            },
            getItem: function (key) {
              key = String(key);
              return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
            },
            key: function (index) {
              var keys = Object.keys(store);
              return keys[index] || null;
            },
            removeItem: function (key) {
              delete store[String(key)];
            },
            setItem: function (key, value) {
              store[String(key)] = String(value);
            }
          };
        }

        function ensureStorage(name) {
          try {
            var storage = window[name];
            var testKey = "__gatewayz_storage_test__";
            storage.setItem(testKey, "1");
            storage.removeItem(testKey);
            return;
          } catch (error) {
            var fallback = createMemoryStorage();
            try {
              Object.defineProperty(window, name, {
                configurable: true,
                enumerable: true,
                writable: true,
                value: fallback
              });
              console.warn("[StorageShim] Replaced " + name + " with fallback:", error);
              return;
            } catch (defineError) {
              try {
                window[name] = fallback;
                console.warn("[StorageShim] Assigned fallback for " + name + ":", error);
                return;
              } catch (assignError) {
                console.error("[StorageShim] Unable to provide fallback for " + name + ":", assignError);
              }
            }
          }
        }

        ensureStorage("localStorage");
        ensureStorage("sessionStorage");
      })();
      `}
    </Script>
  );
}
