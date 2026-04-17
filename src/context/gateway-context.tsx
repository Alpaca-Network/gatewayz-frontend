'use client';

import React, { createContext, useContext, useCallback, useState } from 'react';

// AI SDK removed — all models route through gatewayz backend
export type GatewayType = 'gatewayz';

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

export function GatewayProvider({ children }: GatewayProviderProps) {
  const [currentModel, setCurrentModel] = useState<string | null>(null);

  const handleSetModel = useCallback((modelId: string) => {
    setCurrentModel(modelId);
  }, []);

  const getGatewayType = useCallback((_modelId: string): GatewayType => 'gatewayz', []);
  const canUseThinking = useCallback((_modelId: string): boolean => false, []);

  const value: GatewayContextType = {
    currentGateway: currentModel ? 'gatewayz' : null,
    currentModel,
    supportsThinking: false,
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

export function useGateway(): GatewayContextType {
  const context = useContext(GatewayContext);
  if (context === undefined) {
    throw new Error('useGateway must be used within a GatewayProvider');
  }
  return context;
}
