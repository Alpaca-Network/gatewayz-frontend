/**
 * Model Synchronization Service
 * Handles automated updates of model data from multiple providers
 */

import { getModelsForGateway } from './models-service';
import * as Sentry from '@sentry/nextjs';

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
  pricing: {
    prompt: string;
    completion: string;
  };
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
  private syncIntervals: Map<string, NodeJS.Timeout> = new Map();
  private readonly SYNC_INTERVALS = {
    high_frequency: ['openrouter', 'groq', 'together', 'fireworks'], // 15 minutes
    medium_frequency: ['google', 'cerebras', 'nebius', 'xai'], // 1 hour
    low_frequency: ['huggingface', 'aimo', 'near', 'fal', 'vercel-ai-gateway'], // 4 hours
  };

  /**
   * Initialize automated synchronization for all gateways
   */
  async initializeSync(): Promise<void> {
    console.log('[ModelSync] Initializing automated model synchronization...');
    
    const allGateways = [
      'openrouter', 'featherless', 'groq', 'together', 'fireworks',
      'chutes', 'deepinfra', 'google', 'cerebras', 'nebius',
      'xai', 'novita', 'huggingface', 'aimo', 'near', 'fal',
      'vercel-ai-gateway', 'helicone', 'alpaca'
    ];

    // Start with an initial sync for all gateways
    await this.performFullSync();

    // Set up recurring sync intervals
    for (const gateway of allGateways) {
      this.setupGatewaySync(gateway);
    }

    // Set up daily full sync at 2 AM UTC
    this.setupDailyFullSync();
  }

  /**
   * Set up sync interval for a specific gateway based on its frequency tier
   */
  private setupGatewaySync(gateway: string): void {
    let intervalMs: number;

    if (this.SYNC_INTERVALS.high_frequency.includes(gateway)) {
      intervalMs = 15 * 60 * 1000; // 15 minutes
    } else if (this.SYNC_INTERVALS.medium_frequency.includes(gateway)) {
      intervalMs = 60 * 60 * 1000; // 1 hour
    } else {
      intervalMs = 4 * 60 * 60 * 1000; // 4 hours
    }

    const interval = setInterval(async () => {
      try {
        await this.syncGateway(gateway);
      } catch (error) {
        console.error(`[ModelSync] Failed to sync gateway ${gateway}:`, error);
        Sentry.captureException(error, {
          tags: { gateway, sync_type: 'gateway_interval' }
        });
      }
    }, intervalMs);

    this.syncIntervals.set(gateway, interval);
    console.log(`[ModelSync] Set up ${intervalMs / 60000}min sync interval for ${gateway}`);
  }

  /**
   * Set up daily full sync at 2 AM UTC
   */
  private setupDailyFullSync(): void {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setUTCHours(2, 0, 0, 0);

    const msUntil2AM = tomorrow.getTime() - now.getTime();

    setTimeout(() => {
      // Perform daily sync
      this.performFullSync();

      // Set up recurring daily sync
      setInterval(() => {
        this.performFullSync();
      }, 24 * 60 * 60 * 1000);
    }, msUntil2AM);

    console.log(`[ModelSync] Scheduled daily full sync at 2 AM UTC (in ${Math.round(msUntil2AM / (60 * 60 * 1000))} hours)`);
  }

  /**
   * Sync a specific gateway and track changes
   */
  async syncGateway(gateway: string): Promise<ModelSyncResult> {
    const startTime = Date.now();
    const previousSnapshot = this.snapshots.get(gateway);

    try {
      // Fetch current models
      const result = await getModelsForGateway(gateway);
      const currentModels: ModelRecord[] = result.data;

      // Create snapshot
      const snapshot: ModelSnapshot = {
        timestamp: startTime,
        models: currentModels,
        checksum: this.calculateChecksum(currentModels)
      };

      // Calculate changes if we have previous data
      let newModels = 0;
      let updatedModels = 0;
      let removedModels = 0;

      if (previousSnapshot) {
        const changes = this.compareSnapshots(previousSnapshot, snapshot);
        newModels = changes.newModels;
        updatedModels = changes.updatedModels;
        removedModels = changes.removedModels;

        // Log significant changes
        if (newModels > 0 || updatedModels > 0 || removedModels > 0) {
          console.log(`[ModelSync] ${gateway}: +${newModels} ~${updatedModels} -${removedModels} models`);
          
          // Trigger cache invalidation if there are changes
          if (newModels > 0 || updatedModels > 0) {
            await this.invalidateCache(gateway);
          }
        }
      }

      // Store snapshot
      this.snapshots.set(gateway, snapshot);

      const syncResult: ModelSyncResult = {
        gateway,
        totalModels: currentModels.length,
        newModels,
        updatedModels,
        removedModels,
        lastSyncTimestamp: startTime
      };

      // Log to analytics for monitoring
      await this.logSyncResult(syncResult);

      return syncResult;

    } catch (error) {
      console.error(`[ModelSync] Error syncing ${gateway}:`, error);
      
      const result: ModelSyncResult = {
        gateway,
        totalModels: 0,
        newModels: 0,
        updatedModels: 0,
        removedModels: 0,
        lastSyncTimestamp: startTime,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };

      Sentry.captureException(error, {
        tags: { gateway, sync_type: 'gateway_sync' },
        extra: result
      });

      return result;
    }
  }

  /**
   * Perform full sync of all gateways
   */
  async performFullSync(): Promise<ModelSyncResult[]> {
    console.log('[ModelSync] Starting full sync of all gateways...');
    
    const allGateways = [
      'openrouter', 'featherless', 'groq', 'together', 'fireworks',
      'chutes', 'deepinfra', 'google', 'cerebras', 'nebius',
      'xai', 'novita', 'huggingface', 'aimo', 'near', 'fal',
      'vercel-ai-gateway', 'helicone', 'alpaca'
    ];

    const results = await Promise.allSettled(
      allGateways.map(gateway => this.syncGateway(gateway))
    );

    const successfulResults = results
      .filter((result): result is PromiseFulfilledResult<ModelSyncResult> => result.status === 'fulfilled')
      .map(result => result.value);

    const failedGateways = results
      .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
      .map((result, index) => ({ gateway: allGateways[index], error: result.reason }));

    if (failedGateways.length > 0) {
      console.error(`[ModelSync] ${failedGateways.length} gateways failed to sync:`, failedGateways);
    }

    const totalModels = successfulResults.reduce((sum, result) => sum + result.totalModels, 0);
    const totalNewModels = successfulResults.reduce((sum, result) => sum + result.newModels, 0);
    
    console.log(`[ModelSync] Full sync complete: ${totalModels} total models, ${totalNewModels} new models`);

    return successfulResults;
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

    // Check for updated models (same ID but different content)
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
   * Check if two models are equal (for change detection)
   */
  private modelsEqual(a: ModelRecord, b: ModelRecord): boolean {
    return (
      a.name === b.name &&
      a.context_length === b.context_length &&
      a.pricing.prompt === b.pricing.prompt &&
      a.pricing.completion === b.pricing.completion &&
      JSON.stringify(a.architecture) === JSON.stringify(b.architecture) &&
      JSON.stringify(a.supported_parameters) === JSON.stringify(b.supported_parameters)
    );
  }

  /**
   * Calculate checksum for model data (for integrity checking)
   */
  private calculateChecksum(models: ModelRecord[]): string {
    const modelData = models
      .map(m => `${m.id}:${m.name}:${JSON.stringify(m.pricing)}`)
      .sort()
      .join('|');
    
    // Simple hash function (in production, use crypto)
    let hash = 0;
    for (let i = 0; i < modelData.length; i++) {
      const char = modelData.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Invalidate cache for a specific gateway
   */
  private async invalidateCache(gateway: string): Promise<void> {
    try {
      // Call the cache invalidation endpoint
      await fetch(`${API_BASE_URL}/api/cache/invalidate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gateway })
      });
      console.log(`[ModelSync] Invalidated cache for ${gateway}`);
    } catch (error) {
      console.error(`[ModelSync] Failed to invalidate cache for ${gateway}:`, error);
    }
  }

  /**
   * Log sync results to analytics
   */
  private async logSyncResult(result: ModelSyncResult): Promise<void> {
    try {
      // Log to your analytics service (Statsig, PostHog, etc.)
      console.log('[ModelSync] Sync result:', {
        gateway: result.gateway,
        total_models: result.totalModels,
        new_models: result.newModels,
        updated_models: result.updatedModels,
        removed_models: result.removedModels,
        sync_duration: Date.now() - result.lastSyncTimestamp
      });
    } catch (error) {
      console.error('[ModelSync] Failed to log sync result:', error);
    }
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
   * Stop all sync intervals
   */
  stopSync(): void {
    for (const interval of this.syncIntervals.values()) {
      clearInterval(interval);
    }
    this.syncIntervals.clear();
    console.log('[ModelSync] Stopped all synchronization intervals');
  }
}

// Singleton instance
export const modelSyncService = new ModelSyncService();

// Export for use in API routes
export { ModelSyncService };