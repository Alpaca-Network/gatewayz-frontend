/**
 * Hook to fetch tool definitions from the backend API
 *
 * Tool definitions are cached for 30 minutes since they rarely change.
 */

import { useQuery } from '@tanstack/react-query';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.gatewayz.ai';

export interface ToolFunctionDefinition {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface ToolDefinition {
  type: string;
  function: ToolFunctionDefinition;
}

/**
 * Fetch tool definitions from the backend
 */
async function fetchToolDefinitions(): Promise<ToolDefinition[]> {
  const response = await fetch(`${API_BASE_URL}/v1/tools/definitions`);

  if (!response.ok) {
    throw new Error(`Failed to fetch tool definitions: ${response.status}`);
  }

  const data = await response.json();
  return data;
}

/**
 * Hook to get tool definitions with caching
 *
 * @returns Query result with tool definitions
 */
export function useToolDefinitions() {
  return useQuery<ToolDefinition[]>({
    queryKey: ['tool-definitions'],
    queryFn: fetchToolDefinitions,
    staleTime: 1000 * 60 * 30, // Cache for 30 minutes
    gcTime: 1000 * 60 * 60,    // Keep in garbage collection for 1 hour
    retry: 2,
    refetchOnWindowFocus: false,
  });
}

/**
 * Filter tool definitions by enabled tool names
 *
 * @param definitions - All available tool definitions
 * @param enabledTools - List of enabled tool names
 * @returns Filtered tool definitions
 */
export function filterEnabledTools(
  definitions: ToolDefinition[] | undefined,
  enabledTools: string[]
): ToolDefinition[] {
  if (!definitions || enabledTools.length === 0) {
    return [];
  }

  return definitions.filter(tool =>
    enabledTools.includes(tool.function.name)
  );
}

export default useToolDefinitions;
