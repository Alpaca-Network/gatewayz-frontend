/**
 * ComfyUI API Service
 *
 * Client-side service for interacting with the ComfyUI backend API.
 * Provides workflow listing, execution, and progress streaming.
 */

import { getApiKey } from './api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.gatewayz.ai';

// ============================================================================
// Types
// ============================================================================

export type WorkflowType =
  | 'text-to-image'
  | 'image-to-image'
  | 'text-to-video'
  | 'image-to-video'
  | 'upscale'
  | 'inpaint'
  | 'outpaint'
  | 'custom';

export type ExecutionStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  type: WorkflowType;
  workflow_json: Record<string, unknown>;
  thumbnail_url: string | null;
  default_params: Record<string, unknown>;
  param_schema: Record<string, unknown>;
  credits_per_run: number;
  estimated_time_seconds: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface ExecutionRequest {
  workflow_id?: string;
  workflow_json?: Record<string, unknown>;
  params?: Record<string, unknown>;
  prompt?: string;
  negative_prompt?: string;
  width?: number;
  height?: number;
  steps?: number;
  cfg_scale?: number;
  seed?: number;
  input_image?: string;
  input_video?: string;
  denoise_strength?: number;
  frames?: number;
  fps?: number;
}

export interface ExecutionOutput {
  type: 'image' | 'video' | 'audio' | 'text';
  url?: string;
  b64_data?: string;
  filename?: string;
  content_type?: string;
  width?: number;
  height?: number;
  duration_seconds?: number;
  metadata?: Record<string, unknown>;
  error?: string;
}

export interface ExecutionResponse {
  execution_id: string;
  status: ExecutionStatus;
  workflow_type: WorkflowType | null;
  progress: number;
  current_node: string | null;
  queue_position: number | null;
  estimated_time_remaining: number | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  outputs: ExecutionOutput[];
  error: string | null;
  credits_charged: number | null;
  execution_time_ms: number | null;
}

export interface ProgressUpdate {
  execution_id: string;
  status: ExecutionStatus;
  progress: number;
  current_node?: string;
  node_progress?: number;
  preview_image?: string;
  message?: string;
}

export interface ServerStatus {
  connected: boolean;
  server_url: string | null;
  queue_size: number;
  running_jobs: number;
  available_models: string[];
  system_stats: Record<string, unknown>;
  last_ping: string | null;
}

export interface WorkflowListResponse {
  workflows: WorkflowTemplate[];
  total: number;
}

// ============================================================================
// API Functions
// ============================================================================

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('API key not found. Please log in.');
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || `Request failed: ${response.status}`);
  }

  return response;
}

/**
 * Get ComfyUI server status
 */
export async function getServerStatus(): Promise<ServerStatus> {
  const response = await fetchWithAuth(`${API_BASE_URL}/comfyui/status`);
  return response.json();
}

/**
 * List available workflow templates
 */
export async function listWorkflows(type?: WorkflowType): Promise<WorkflowListResponse> {
  const url = new URL(`${API_BASE_URL}/comfyui/workflows`);
  if (type) {
    url.searchParams.set('workflow_type', type);
  }
  const response = await fetchWithAuth(url.toString());
  return response.json();
}

/**
 * Get a specific workflow template
 */
export async function getWorkflow(workflowId: string): Promise<WorkflowTemplate> {
  const response = await fetchWithAuth(`${API_BASE_URL}/comfyui/workflows/${workflowId}`);
  return response.json();
}

/**
 * Execute a workflow (non-streaming)
 */
export async function executeWorkflow(request: ExecutionRequest): Promise<ExecutionResponse> {
  const response = await fetchWithAuth(`${API_BASE_URL}/comfyui/execute`, {
    method: 'POST',
    body: JSON.stringify(request),
  });
  return response.json();
}

/**
 * Execute a workflow with streaming progress updates
 */
export async function* executeWorkflowStream(
  request: ExecutionRequest
): AsyncGenerator<ProgressUpdate | ExecutionResponse, void, unknown> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('API key not found. Please log in.');
  }

  const response = await fetch(`${API_BASE_URL}/comfyui/execute/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      Accept: 'text/event-stream',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || `Request failed: ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            yield data;
          } catch {
            // Skip invalid JSON
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Get execution status
 */
export async function getExecutionStatus(executionId: string): Promise<ExecutionResponse> {
  const response = await fetchWithAuth(`${API_BASE_URL}/comfyui/executions/${executionId}`);
  return response.json();
}

/**
 * Cancel an execution
 */
export async function cancelExecution(executionId: string): Promise<{ status: string; execution_id: string }> {
  const response = await fetchWithAuth(`${API_BASE_URL}/comfyui/executions/${executionId}/cancel`, {
    method: 'POST',
  });
  return response.json();
}

/**
 * Get available models on the ComfyUI server
 */
export async function getAvailableModels(): Promise<{ models: string[]; connected: boolean }> {
  const response = await fetchWithAuth(`${API_BASE_URL}/comfyui/models`);
  return response.json();
}

/**
 * Get queue status
 */
export async function getQueueStatus(): Promise<{
  queue_size: number;
  running_jobs: number;
  connected: boolean;
}> {
  const response = await fetchWithAuth(`${API_BASE_URL}/comfyui/queue`);
  return response.json();
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert a File to base64 data URL
 */
export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Compress an image file before upload
 */
export async function compressImage(
  file: File,
  maxWidth = 1920,
  maxHeight = 1920,
  quality = 0.85
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;

      // Calculate new dimensions
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width *= ratio;
        height *= ratio;
      }

      // Create canvas and draw
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      // Convert to base64
      const base64 = canvas.toDataURL('image/jpeg', quality);
      resolve(base64);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Get workflow type display name
 */
export function getWorkflowTypeDisplayName(type: WorkflowType): string {
  const names: Record<WorkflowType, string> = {
    'text-to-image': 'Text to Image',
    'image-to-image': 'Image to Image',
    'text-to-video': 'Text to Video',
    'image-to-video': 'Image to Video',
    upscale: 'Upscale',
    inpaint: 'Inpaint',
    outpaint: 'Outpaint',
    custom: 'Custom',
  };
  return names[type] || type;
}

/**
 * Get status display info
 */
export function getStatusDisplayInfo(status: ExecutionStatus): {
  label: string;
  color: string;
} {
  const info: Record<ExecutionStatus, { label: string; color: string }> = {
    queued: { label: 'Queued', color: 'text-yellow-500' },
    running: { label: 'Running', color: 'text-blue-500' },
    completed: { label: 'Completed', color: 'text-green-500' },
    failed: { label: 'Failed', color: 'text-red-500' },
    cancelled: { label: 'Cancelled', color: 'text-gray-500' },
  };
  return info[status] || { label: status, color: 'text-gray-500' };
}
