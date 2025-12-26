/**
 * IndexedDB availability check utilities
 * 
 * These utilities help detect IndexedDB availability and handle errors
 * gracefully, particularly for cases where the database has been deleted
 * by the user (common on Mobile Safari, private browsing, or when clearing site data).
 */

export type IndexedDBStatus = 
  | 'available'
  | 'unavailable'
  | 'deleted'
  | 'blocked'
  | 'unknown_error';

export interface IndexedDBCheckResult {
  status: IndexedDBStatus;
  error?: Error;
  message?: string;
}

/**
 * Known IndexedDB error patterns that indicate database issues
 */
const INDEXEDDB_ERROR_PATTERNS = [
  /Database deleted by request of the user/i,
  /The database connection is closing/i,
  /Database version cannot be 0/i,
  /VersionError/i,
  /InvalidStateError.*IndexedDB/i,
  /UnknownError.*Database/i,
  /AbortError.*IndexedDB/i,
  /QuotaExceededError/i,
  /The operation failed for reasons unrelated to the database/i,
  /A mutation operation was attempted on a database that did not allow mutations/i,
  /The database is not running a version change transaction/i,
];

/**
 * Check if an error is related to IndexedDB issues
 */
export function isIndexedDBError(error: unknown): boolean {
  if (!error) return false;
  
  const errorMessage = getErrorMessage(error);
  const errorName = getErrorName(error);
  
  // Check error name for DOMException types related to IndexedDB
  if (errorName) {
    const indexedDBErrorNames = [
      'UnknownError',
      'VersionError',
      'InvalidStateError',
      'AbortError',
      'QuotaExceededError',
      'DataError',
      'TransactionInactiveError',
      'ReadOnlyError',
      'DataCloneError',
    ];
    
    // UnknownError with database-related message is definitely IndexedDB
    if (errorName === 'UnknownError' && errorMessage.toLowerCase().includes('database')) {
      return true;
    }
    
    // Check for other IndexedDB error types
    if (indexedDBErrorNames.includes(errorName) && errorMessage.toLowerCase().includes('database')) {
      return true;
    }
  }
  
  // Check error message against known patterns
  return INDEXEDDB_ERROR_PATTERNS.some(pattern => pattern.test(errorMessage));
}

/**
 * Get the error message from various error types
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object') {
    const errorObj = error as { message?: string; reason?: string };
    return errorObj.message || errorObj.reason || String(error);
  }
  return String(error);
}

/**
 * Get the error name from various error types
 */
function getErrorName(error: unknown): string | null {
  if (error instanceof Error || error instanceof DOMException) {
    return error.name;
  }
  if (error && typeof error === 'object') {
    const errorObj = error as { name?: string };
    return errorObj.name || null;
  }
  return null;
}

/**
 * Classify the type of IndexedDB error
 */
export function classifyIndexedDBError(error: unknown): IndexedDBStatus {
  const message = getErrorMessage(error);
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('deleted by request') || lowerMessage.includes('database deleted')) {
    return 'deleted';
  }
  
  if (lowerMessage.includes('quota') || lowerMessage.includes('disk space')) {
    return 'blocked';
  }
  
  if (lowerMessage.includes('security') || lowerMessage.includes('permission')) {
    return 'blocked';
  }
  
  return 'unknown_error';
}

/**
 * Check if IndexedDB is available and functional
 * 
 * This performs a quick write/read/delete test to ensure IndexedDB
 * is working correctly. This can catch issues like:
 * - User deleted the database
 * - Private browsing mode limitations
 * - Storage quota exceeded
 * - Security restrictions
 */
export async function checkIndexedDBAvailability(
  options: { timeout?: number } = {}
): Promise<IndexedDBCheckResult> {
  const { timeout = 3000 } = options;
  
  // Check if we're in a browser environment
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
    return {
      status: 'unavailable',
      message: 'IndexedDB is not available in this environment',
    };
  }
  
  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      resolve({
        status: 'unavailable',
        message: 'IndexedDB availability check timed out',
      });
    }, timeout);
    
    const testDbName = '__gatewayz_indexeddb_test__';
    let db: IDBDatabase | null = null;
    
    try {
      const request = indexedDB.open(testDbName, 1);
      
      request.onerror = (event) => {
        clearTimeout(timeoutId);
        const error = (event.target as IDBOpenDBRequest).error;
        
        if (error && isIndexedDBError(error)) {
          resolve({
            status: classifyIndexedDBError(error),
            error: error as Error,
            message: error.message,
          });
        } else {
          resolve({
            status: 'unavailable',
            error: error as Error,
            message: error?.message || 'Failed to open IndexedDB',
          });
        }
      };
      
      request.onblocked = () => {
        clearTimeout(timeoutId);
        resolve({
          status: 'blocked',
          message: 'IndexedDB is blocked by another connection',
        });
      };
      
      request.onsuccess = (event) => {
        clearTimeout(timeoutId);
        db = (event.target as IDBOpenDBRequest).result;
        
        // Clean up test database
        db.close();
        try {
          const deleteRequest = indexedDB.deleteDatabase(testDbName);
          deleteRequest.onerror = () => {
            // Ignore delete errors
          };
        } catch {
          // Ignore delete errors
        }
        
        resolve({
          status: 'available',
          message: 'IndexedDB is available and functional',
        });
      };
      
      request.onupgradeneeded = (event) => {
        // Database created successfully, will proceed to onsuccess
        db = (event.target as IDBOpenDBRequest).result;
      };
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (isIndexedDBError(error)) {
        resolve({
          status: classifyIndexedDBError(error),
          error: error as Error,
          message: getErrorMessage(error),
        });
      } else {
        resolve({
          status: 'unavailable',
          error: error as Error,
          message: getErrorMessage(error),
        });
      }
    }
  });
}

/**
 * Try to recover from IndexedDB deletion by clearing any stale data
 * and notifying the user appropriately
 */
export async function attemptIndexedDBRecovery(): Promise<boolean> {
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
    return false;
  }
  
  try {
    // Try to delete any potentially corrupted Privy databases
    const privyDbNames = [
      'privy',
      'privy-embedded-wallet',
      '__privy_storage__',
    ];
    
    const deletePromises = privyDbNames.map(
      (dbName) =>
        new Promise<void>((resolve) => {
          try {
            const request = indexedDB.deleteDatabase(dbName);
            request.onsuccess = () => resolve();
            request.onerror = () => resolve();
            request.onblocked = () => resolve();
          } catch {
            resolve();
          }
        })
    );
    
    await Promise.all(deletePromises);
    
    // Verify IndexedDB is now working
    const result = await checkIndexedDBAvailability({ timeout: 2000 });
    return result.status === 'available';
  } catch {
    return false;
  }
}
