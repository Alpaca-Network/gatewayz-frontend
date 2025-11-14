/**
 * Background Model Sync Initialization
 * Starts automated model synchronization when the app starts
 */

import { modelSyncService } from '@/lib/model-sync-service';

// Global flag to prevent multiple initializations
let isInitialized = false;

export async function initializeModelSync() {
  if (isInitialized) {
    console.log('[ModelSync] Already initialized, skipping...');
    return;
  }

  try {
    console.log('[ModelSync] Starting background synchronization...');
    await modelSyncService.initializeSync();
    isInitialized = true;
    console.log('[ModelSync] Background synchronization started successfully');
  } catch (error) {
    console.error('[ModelSync] Failed to initialize background sync:', error);
    // Don't throw to prevent app startup failure
  }
}

// Export for use in layout.tsx or other initialization points
export { modelSyncService };