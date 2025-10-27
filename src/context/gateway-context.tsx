'use client';

import React, { createContext, useContext, useCallback, useState } from 'react';
import { useGatewayRouter, type GatewayType } from '@/hooks/useGatewayRouter';

interface GatewayContextType {
  currentGateway: GatewayType | null;
  currentModel: string | null;
  supportsThinking: boolean;
  setModel: (modelId: string) => void;
  getGatewayType: (modelId: string) => GatewayType;
  canUseThinking: (modelId: string) => boolean;
}

const GatewayContext = createContext<GatewayContextType | undefined>(undefined);

interface GatewayProviderProps {
  children: React.ReactNode;
}

/**
 * Provider for managing gateway selection and chain-of-thought capabilities
 *
 * Usage:
 * ```tsx
 * <GatewayProvider>
 *   <ChatPage />
 * </GatewayProvider>
 * ```
 */
export function GatewayProvider({ children }: GatewayProviderProps) {
  const [currentModel, setCurrentModel] = useState<string | null>(null);
  const gatewayRouter = useGatewayRouter();

  const currentGateway = currentModel
    ? gatewayRouter.isAISDK(currentModel)
      ? 'ai-sdk'
      : 'gatewayz'
    : null;

  const supportsThinking = currentModel
    ? gatewayRouter.supportsThinking(currentModel)
    : false;

  const handleSetModel = useCallback((modelId: string) => {
    setCurrentModel(modelId);
  }, []);

  const getGatewayType = useCallback(
    (modelId: string): GatewayType => {
      return gatewayRouter.isAISDK(modelId) ? 'ai-sdk' : 'gatewayz';
    },
    [gatewayRouter]
  );

  const canUseThinking = useCallback(
    (modelId: string): boolean => {
      return gatewayRouter.supportsThinking(modelId);
    },
    [gatewayRouter]
  );

  const value: GatewayContextType = {
    currentGateway,
    currentModel,
    supportsThinking,
    setModel: handleSetModel,
    getGatewayType,
    canUseThinking,
  };

  return (
    <GatewayContext.Provider value={value}>
      {children}
    </GatewayContext.Provider>
  );
}

/**
 * Hook to use the gateway context
 *
 * Usage:
 * ```tsx
 * const { currentGateway, supportsThinking } = useGateway();
 * ```
 */
export function useGateway(): GatewayContextType {
  const context = useContext(GatewayContext);
  if (context === undefined) {
    throw new Error('useGateway must be used within a GatewayProvider');
  }
  return context;
}
