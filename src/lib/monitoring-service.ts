/**
 * Monitoring Service
 * 
 * Centralized service for making monitoring API calls with optional authentication.
 * 
 * Features:
 * - Optional authentication via Bearer token
 * - Automatic fallback to unauthenticated requests on 401 errors
 * - Type-safe request/response handling
 * - Consistent error handling
 * 
 * Usage:
 *   // Without authentication (public access)
 *   const health = await monitoringService.getProviderHealth();
 * 
 *   // With authentication (for logged-in users)
 *   const apiKey = getApiKey();
 *   const health = await monitoringService.getProviderHealth(apiKey);
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.gatewayz.ai';

interface FetchOptions {
  apiKey?: string;
  retryWithoutAuth?: boolean;
}

/**
 * Makes an authenticated or unauthenticated fetch request to monitoring endpoints
 * 
 * @param url - The endpoint URL to fetch
 * @param options - Optional configuration including API key
 * @returns Response data
 * @throws Error if request fails
 */
async function fetchWithOptionalAuth<T>(
  url: string,
  options: FetchOptions = {}
): Promise<T> {
  const { apiKey, retryWithoutAuth = true } = options;
  
  const headers: HeadersInit = {};
  
  // Add authentication if API key is provided
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }
  
  try {
    const response = await fetch(url, { headers });
    
    // Handle 401 - Invalid or expired API key
    if (response.status === 401 && apiKey && retryWithoutAuth) {
      console.warn('[monitoring-service] API key invalid, retrying without auth');
      
      // Retry without authentication
      return fetchWithOptionalAuth<T>(url, { 
        apiKey: undefined, 
        retryWithoutAuth: false // Prevent infinite retry loop
      });
    }
    
    // Handle 404 - No data available
    if (response.status === 404) {
      throw new Error('No data available');
    }
    
    // Handle other errors
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    // Network errors, JSON parse errors, etc.
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Unknown error occurred');
  }
}

/**
 * Monitoring Service
 * Provides methods for all monitoring-related API calls
 */
export const monitoringService = {
  /**
   * Get health data for a specific model
   * 
   * @param provider - Provider name (e.g., "openai")
   * @param model - Model name (e.g., "gpt-4")
   * @param apiKey - Optional API key for authenticated requests
   * @returns Model health data or null if not available
   */
  async getModelHealth(
    provider: string,
    model: string,
    apiKey?: string
  ): Promise<any> {
    const url = `${API_BASE_URL}/v1/model-health/${provider}/${model}`;
    
    try {
      return await fetchWithOptionalAuth(url, { apiKey });
    } catch (error) {
      if (error instanceof Error && error.message === 'No data available') {
        return null;
      }
      throw error;
    }
  },

  /**
   * Get overall system health statistics
   * 
   * @param apiKey - Optional API key for authenticated requests
   * @returns System-wide health statistics
   */
  async getHealthStats(apiKey?: string): Promise<any> {
    const url = `${API_BASE_URL}/v1/model-health/stats`;
    return fetchWithOptionalAuth(url, { apiKey });
  },

  /**
   * Get list of all models with health data
   * 
   * @param limit - Number of results to return (default: 50)
   * @param offset - Offset for pagination (default: 0)
   * @param apiKey - Optional API key for authenticated requests
   * @returns Paginated list of model health data
   */
  async getModelHealthList(
    limit: number = 50,
    offset: number = 0,
    apiKey?: string
  ): Promise<any> {
    const url = `${API_BASE_URL}/v1/model-health?limit=${limit}&offset=${offset}`;
    return fetchWithOptionalAuth(url, { apiKey });
  },

  /**
   * Get list of unhealthy models
   * 
   * @param errorThreshold - Error rate threshold (0-1, default: 0.2 = 20%)
   * @param apiKey - Optional API key for authenticated requests
   * @returns List of models exceeding error threshold
   */
  async getUnhealthyModels(
    errorThreshold: number = 0.2,
    apiKey?: string
  ): Promise<any> {
    const url = `${API_BASE_URL}/v1/model-health/unhealthy?error_threshold=${errorThreshold}`;
    return fetchWithOptionalAuth(url, { apiKey });
  },

  /**
   * Get summary for a specific provider
   * 
   * @param provider - Provider name (e.g., "openai")
   * @param apiKey - Optional API key for authenticated requests
   * @returns Provider summary with aggregated health metrics
   */
  async getProviderSummary(
    provider: string,
    apiKey?: string
  ): Promise<any> {
    const url = `${API_BASE_URL}/v1/model-health/provider/${provider}/summary`;
    return fetchWithOptionalAuth(url, { apiKey });
  },

  /**
   * Get list of all providers with health data
   * 
   * @param apiKey - Optional API key for authenticated requests
   * @returns List of provider names
   */
  async getProviderList(apiKey?: string): Promise<any> {
    const url = `${API_BASE_URL}/v1/model-health/providers`;
    return fetchWithOptionalAuth(url, { apiKey });
  }
};

export default monitoringService;
