// flags.ts
import { statsigAdapter, type StatsigUser } from "@flags-sdk/statsig";
import { flag, dedupe } from "flags/next";
import type { Identify } from "flags";

/**
 * Identify function for Flags SDK
 * This function provides user context for feature flag evaluation
 *
 * Customize this function to:
 * - Extract user information from request headers, cookies, or session
 * - Add custom user attributes for targeting (e.g., organization, plan, location)
 * - Return stable user identifiers for consistent flag evaluations
 *
 * See docs.statsig.com/concepts/user for more details on user objects
 */
export const identify = dedupe((async () => ({
  // TODO: Implement proper user identification
  // For example, you might want to:
  // - Extract user ID from authentication token
  // - Get user attributes from database
  // - Add custom properties like subscription tier, region, etc.

  userID: "1234", // Replace with actual user ID

  // Optional: Add custom attributes for targeting
  // email: "user@example.com",
  // custom: {
  //   plan: "pro",
  //   organization: "acme-corp",
  //   region: "us-east"
  // }
})) satisfies Identify<StatsigUser>);

/**
 * Factory function to create feature flags
 *
 * @param key - The feature gate key from Statsig dashboard
 * @returns A function that evaluates the feature flag for the current user
 *
 * @example
 * ```typescript
 * const myFlag = createFeatureFlag("my_feature_flag");
 * const isEnabled = await myFlag();
 *
 * if (isEnabled) {
 *   // Feature is enabled
 * }
 * ```
 */
export const createFeatureFlag = (key: string) => flag<boolean, StatsigUser>({
  key,
  adapter: statsigAdapter.featureGate((gate) => gate.value, {
    exposureLogging: true
  }),
  identify,
});

/**
 * Example usage:
 *
 * // In a Next.js page or API route:
 * import { createFeatureFlag } from "./flags";
 *
 * export default async function Page() {
 *   const showNewFeature = await createFeatureFlag("new_feature_rollout")();
 *
 *   return (
 *     <div>
 *       {showNewFeature ? (
 *         <NewFeatureComponent />
 *       ) : (
 *         <LegacyFeatureComponent />
 *       )}
 *     </div>
 *   );
 * }
 */
