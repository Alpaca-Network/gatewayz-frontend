import { initLogger } from "braintrust";

/**
 * Braintrust logger instance for LLM tracing
 * Initialized with API key from environment variables
 */
export const braintrustLogger = initLogger({
  projectName: "Gatewayz",
  apiKey: process.env.BRAINTRUST_API_KEY,
});

/**
 * Helper function to check if Braintrust is configured
 */
export function isBraintrustEnabled(): boolean {
  return !!process.env.BRAINTRUST_API_KEY;
}
