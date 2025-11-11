'use client';

import { useCallback } from 'react';
import { isAISDKModel, getAISDKModelMetadata } from '@/lib/ai-sdk-gateway';
import { isAISDKModel as isChatServiceAISDKModel } from '@/lib/ai-sdk-chat-service';

export type GatewayType = 'ai-sdk' | 'gatewayz';

export interface GatewayRouterConfig {
  modelId: string;
  apiKey: string;
}

export interface GatewayInfo {
  type: GatewayType;
  supportsThinking: boolean;
  modelMetadata?: any;
}

/**
 * Custom hook for routing requests to the appropriate gateway
 * Determines whether to use AI SDK or Gatewayz based on model selection
 *
 * Usage:
 * ```tsx
 * const { getGatewayFor, isAISDK, supportsThinking } = useGatewayRouter();
 *
 * const gateway = getGatewayFor('claude-3-5-sonnet');
 * if (gateway.type === 'ai-sdk' && gateway.supportsThinking) {
 *   // Enable thinking display
 * }
 * ```
 */
export function useGatewayRouter() {
  /**
   * Get gateway information for a specific model
   */
  const getGatewayFor = useCallback(
    (modelId: string): GatewayInfo => {
      // Check if it's an AI SDK model
      if (isAISDKModel(modelId) || isChatServiceAISDKModel(modelId)) {
        const metadata = getAISDKModelMetadata(modelId);
        return {
          type: 'ai-sdk',
          supportsThinking: metadata?.supportsThinking ?? false,
          modelMetadata: metadata,
        };
      }

      // Default to Gatewayz
      return {
        type: 'gatewayz',
        supportsThinking: false,
      };
    },
    []
  );

  /**
   * Check if a model uses AI SDK gateway
   */
  const isAISDK = useCallback(
    (modelId: string): boolean => {
      return getGatewayFor(modelId).type === 'ai-sdk';
    },
    [getGatewayFor]
  );

  /**
   * Check if a model supports chain-of-thought thinking
   */
  const supportsThinking = useCallback(
    (modelId: string): boolean => {
      return getGatewayFor(modelId).supportsThinking;
    },
    [getGatewayFor]
  );

  /**
   * Get the appropriate endpoint for a model
   */
  const getEndpoint = useCallback(
    (modelId: string): string => {
      const gateway = getGatewayFor(modelId);
      if (gateway.type === 'ai-sdk') {
        return '/api/chat/ai-sdk';
      }
      return '/v1/chat/completions';
    },
    [getGatewayFor]
  );

  /**
   * Prepare request body based on gateway type
   */
  const prepareRequest = useCallback(
    (
      modelId: string,
      messages: any[],
      options?: {
        temperature?: number;
        maxTokens?: number;
        topP?: number;
        enableThinking?: boolean;
      }
    ): Record<string, any> => {
      const gateway = getGatewayFor(modelId);
      const baseBody = {
        model: modelId,
        messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 4096,
        top_p: options?.topP ?? 1,
        stream: true,
      };

      if (gateway.type === 'ai-sdk') {
        return {
          ...baseBody,
          enable_thinking:
            options?.enableThinking &&
            gateway.supportsThinking,
        };
      }

      return baseBody;
    },
    [getGatewayFor]
  );

  return {
    getGatewayFor,
    isAISDK,
    supportsThinking,
    getEndpoint,
    prepareRequest,
  };
}

/**
 * Utility function to check multiple models at once
 */
export function getBatchGatewayInfo(modelIds: string[]): Record<string, GatewayInfo> {
  return modelIds.reduce(
    (acc, modelId) => {
      acc[modelId] = {
        type: isAISDKModel(modelId) || isChatServiceAISDKModel(modelId) ? 'ai-sdk' : 'gatewayz',
        supportsThinking:
          (isAISDKModel(modelId) || isChatServiceAISDKModel(modelId)) &&
          (getAISDKModelMetadata(modelId)?.supportsThinking ?? false),
        modelMetadata: getAISDKModelMetadata(modelId),
      };
      return acc;
    },
    {} as Record<string, GatewayInfo>
  );
}
