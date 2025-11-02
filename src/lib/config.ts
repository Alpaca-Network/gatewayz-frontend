// API configuration
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.gatewayz.ai';
export const CHAT_HISTORY_API_URL = process.env.NEXT_PUBLIC_CHAT_HISTORY_API_URL || API_BASE_URL;
export const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || API_BASE_URL;
