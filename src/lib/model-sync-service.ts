/**
 * Model Synchronization Service
 * Handles automated updates of model data from multiple providers
 */

import { getModelsForGateway } from './models-service';
import * as Sentry from '@sentry/nextjs';
import { getErrorMessage, isAbortOrNetworkError } from './network-error';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.gatewayz.ai';

export interface ModelSyncResult {
  gateway: string;
  totalModels: number;
  newModels: number;
  updatedModels: number;
  removedModels: number;
  lastSyncTimestamp: number;
  errors?: string[];
}

export interface ModelSnapshot {
  timestamp: number;
  models: ModelRecord[];
  checksum: string;
}

interface ModelRecord {
  id: string;
  name: string;
  provider_slug: string;
  source_gateways: string[];
  context_length: number;
  pricing?: {
    prompt?: string | number | null;
    completion?: string | number | null;
  } | null;
  architecture: {
    input_modalities: string[];
    output_modalities: string[];
  };
  supported_parameters: string[];
  description?: string;
  is_private?: boolean;
}

class ModelSyncService {
  private snapshots: Map<string, ModelSnapshot> = new Map();
  private globalInterval: NodeJS.Timeout | null = null;
  private readonly REFRESH_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

  /**
   * Initialize automated synchronization using a consolidated approach
   */
  async initializeSync(): Promise<void> {
    if (this.globalInterval) {
      console.log('[ModelSync] Already initialized, skipping...');
      return;
    }

    console.log('[ModelSync] Initializing consolidated model synchronization...');

    // Initial sync
    await this.performFullSync();

    // Set up a single recurring interval for all models
    this.globalInterval = setInterval(async () => {
      try {
        await this.performFullSync();
      } catch (error) {
        console.error('[ModelSync] Consolidated sync failed:', error);
        Sentry.captureException(error, {
          tags: { sync_type: 'consolidated_interval' }
        });
      }
    }, this.REFRESH_INTERVAL_MS);

    console.log(`[ModelSync] Set up ${this.REFRESH_INTERVAL_MS / 60000}min consolidated sync interval`);
  }

  /**
   * Sync all gateways in a single efficient request
   */
  async performFullSync(): Promise<ModelSyncResult[]> {
    const startTime = Date.now();
    console.log('[ModelSync] Starting consolidated full sync...');

    try {
      // Fetch all models in one go
      const result = await getModelsForGateway('all');
      const allModels: ModelRecord[] = result.data || [];

      // Group models by gateway to update per-gateway snapshots
      const gatewayBuckets: Record<string, ModelRecord[]> = {};

      for (const model of allModels) {
        const gateways = model.source_gateways || (model.provider_slug ? [model.provider_slug] : []);
        for (const gateway of gateways) {
          if (!gatewayBuckets[gateway]) gatewayBuckets[gateway] = [];
          gatewayBuckets[gateway].push(model);
        }
      }

      const gatewaysToSync = Object.keys(gatewayBuckets);
      const syncResults: ModelSyncResult[] = [];
      let totalChanges = 0;

      for (const gateway of gatewaysToSync) {
        const currentModels = gatewayBuckets[gateway];
        const previousSnapshot = this.snapshots.get(gateway);

        // Create snapshot
        const snapshot: ModelSnapshot = {
          timestamp: startTime,
          models: currentModels,
          checksum: this.calculateChecksum(currentModels)
        };

        // Calculate changes
        let newModels = 0;
        let updatedModels = 0;
        let removedModels = 0;

        if (previousSnapshot) {
          const changes = this.compareSnapshots(previousSnapshot, snapshot);
          newModels = changes.newModels;
          updatedModels = changes.updatedModels;
          removedModels = changes.removedModels;

          if (newModels > 0 || updatedModels > 0 || removedModels > 0) {
            console.log(`[ModelSync] ${gateway}: +${newModels} ~${updatedModels} -${removedModels} models`);
            totalChanges += (newModels + updatedModels + removedModels);
          }
        }

        this.snapshots.set(gateway, snapshot);

        const syncResult: ModelSyncResult = {
          gateway,
          totalModels: currentModels.length,
          newModels,
          updatedModels,
          removedModels,
          lastSyncTimestamp: startTime
        };

        syncResults.push(syncResult);
      }

      // If any models changed, invalidate the backend cache once for all
      if (totalChanges > 0) {
        await this.invalidateCache();
      }

      console.log(`[ModelSync] Full sync complete: ${allModels.length} models across ${gatewaysToSync.length} gateways`);
      return syncResults;

    } catch (error) {
      console.error('[ModelSync] Full sync failed:', error);
      Sentry.captureException(error, {
        tags: { sync_type: 'full_sync_error' }
      });
      return [];
    }
  }

  /**
   * Invalidate cache on the backend
   */
  private async invalidateCache(): Promise<void> {
    try {
      await fetch(`${API_BASE_URL}/api/cache/invalidate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
        // No gateway param = invalidate all
      });
      console.log('[ModelSync] Invalidated all caches on backend');
    } catch (error) {
      console.error('[ModelSync] Failed to invalidate cache:', error);
    }
  }

  /**
   * Wrapper for backward compatibility, now uses performFullSync
   */
  async syncGateway(gateway: string): Promise<ModelSyncResult> {
    if (gateway === 'all') {
      const results = await this.performFullSync();
      return results[0] || {
        gateway: 'all',
        totalModels: 0,
        newModels: 0,
        updatedModels: 0,
        removedModels: 0,
        lastSyncTimestamp: Date.now()
      };
    }

    // Individual sync is discouraged but kept as fallback
    // We'll just trigger a full sync to keep things consistent
    const results = await this.performFullSync();
    return results.find(r => r.gateway === gateway) || {
      gateway,
      totalModels: 0,
      newModels: 0,
      updatedModels: 0,
      removedModels: 0,
      lastSyncTimestamp: Date.now(),
      errors: ['Gateway not found in full sync']
    };
  }

  /**
   * Compare two snapshots and calculate changes
   */
  private compareSnapshots(previous: ModelSnapshot, current: ModelSnapshot): {
    newModels: number;
    updatedModels: number;
    removedModels: number;
  } {
    const previousIds = new Set(previous.models.map(m => m.id));
    const currentIds = new Set(current.models.map(m => m.id));

    const newModels = current.models.filter(m => !previousIds.has(m.id)).length;
    const removedModels = previous.models.filter(m => !currentIds.has(m.id)).length;

    let updatedModels = 0;
    for (const currentModel of current.models) {
      const previousModel = previous.models.find(m => m.id === currentModel.id);
      if (previousModel && !this.modelsEqual(previousModel, currentModel)) {
        updatedModels++;
      }
    }

    return { newModels, updatedModels, removedModels };
  }

  /**
   * Check if two models are equal
   */
  private modelsEqual(a: ModelRecord, b: ModelRecord): boolean {
    return (
      a.name === b.name &&
      a.context_length === b.context_length &&
      JSON.stringify(a.pricing) === JSON.stringify(b.pricing) &&
      JSON.stringify(a.architecture) === JSON.stringify(b.architecture)
    );
  }

  /**
   * Calculate checksum for model data
   */
  private calculateChecksum(models: ModelRecord[]): string {
    const modelData = models
      .map(m => `${m.id}:${m.name}:${JSON.stringify(m.pricing)}`)
      .sort()
      .join('|');

    let hash = 0;
    for (let i = 0; i < modelData.length; i++) {
      const char = modelData.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Get sync status for all gateways
   */
  getSyncStatus(): { gateway: string; lastSync: number; modelCount: number }[] {
    return Array.from(this.snapshots.entries()).map(([gateway, snapshot]) => ({
      gateway,
      lastSync: snapshot.timestamp,
      modelCount: snapshot.models.length
    }));
  }

  /**
   * Stop recurring sync
   */
  stopSync(): void {
    if (this.globalInterval) {
      clearInterval(this.globalInterval);
      this.globalInterval = null;
    }
    console.log('[ModelSync] Stopped consolidated synchronization');
  }
}

// Singleton instance
export const modelSyncService = new ModelSyncService();

// Export for use in API routes
export { ModelSyncService };