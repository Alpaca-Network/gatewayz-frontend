import { useState, useEffect } from 'react';
import type { ModelOption } from '@/components/chat/model-select';

const RECENTLY_USED_KEY = 'gatewayz_recently_used_models';
const MAX_RECENT_MODELS = 5;

export function useRecentlyUsedModels() {
  const [recentModels, setRecentModels] = useState<ModelOption[]>([]);

  // Load recently used models from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(RECENTLY_USED_KEY);
    if (stored) {
      try {
        setRecentModels(JSON.parse(stored));
      } catch (e) {
        // Invalid data, ignore
      }
    }
  }, []);

  // Add a model to recently used
  const addRecentModel = (model: ModelOption) => {
    setRecentModels(prev => {
      // Remove if already exists
      const filtered = prev.filter(m => m.value !== model.value);
      // Add to front
      const updated = [model, ...filtered].slice(0, MAX_RECENT_MODELS);
      // Persist to localStorage
      localStorage.setItem(RECENTLY_USED_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  // Clear recently used models
  const clearRecentModels = () => {
    setRecentModels([]);
    localStorage.removeItem(RECENTLY_USED_KEY);
  };

  return {
    recentModels,
    addRecentModel,
    clearRecentModels
  };
}
