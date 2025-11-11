/**
 * Feature Flag Usage Examples
 *
 * This file demonstrates various ways to use Statsig feature flags
 * in the Gatewayz application using the Flags SDK.
 */

import { createFeatureFlag } from "../flags";

// ============================================================================
// Example 1: Basic Feature Toggle in a Next.js Page
// ============================================================================

export async function BasicFeatureFlagExample() {
  // Check if a feature flag is enabled
  const isNewFeatureEnabled = await createFeatureFlag("my_feature_flag")();

  return (
    <div>
      <h1>Feature Flag Demo</h1>
      <p>The feature is: {isNewFeatureEnabled ? "ENABLED" : "DISABLED"}</p>

      {isNewFeatureEnabled ? (
        <div>
          <h2>New Feature UI</h2>
          <p>This content is only shown when the flag is enabled.</p>
        </div>
      ) : (
        <div>
          <h2>Legacy Feature UI</h2>
          <p>This content is shown when the flag is disabled.</p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Example 2: Multiple Feature Flags
// ============================================================================

export async function MultipleFeatureFlagsExample() {
  // Check multiple flags in parallel for better performance
  const [showBetaFeatures, enableAdvancedAnalytics, useNewPricingUI] =
    await Promise.all([
      createFeatureFlag("beta_features")(),
      createFeatureFlag("advanced_analytics")(),
      createFeatureFlag("new_pricing_ui")(),
    ]);

  return (
    <div>
      <h1>Dashboard</h1>

      {showBetaFeatures && (
        <div className="beta-banner">
          <p>You have access to beta features!</p>
        </div>
      )}

      <MainContent />

      {enableAdvancedAnalytics && <AdvancedAnalyticsDashboard />}

      {useNewPricingUI ? <NewPricingDisplay /> : <LegacyPricingDisplay />}
    </div>
  );
}

// ============================================================================
// Example 3: API Route with Feature Flag
// ============================================================================

import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  // Use feature flag in API endpoint
  const useNewAlgorithm = await createFeatureFlag("new_recommendation_algorithm")();

  try {
    let results;

    if (useNewAlgorithm) {
      // Use new algorithm
      results = await getRecommendationsV2();
    } else {
      // Use legacy algorithm
      results = await getRecommendationsV1();
    }

    return NextResponse.json({
      success: true,
      data: results,
      algorithm: useNewAlgorithm ? "v2" : "v1",
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to get recommendations" },
      { status: 500 }
    );
  }
}

// ============================================================================
// Example 4: Conditional Backend Integration
// ============================================================================

export async function BackendIntegrationExample() {
  const useNewBackendEndpoint = await createFeatureFlag("use_new_backend_api")();

  const API_ENDPOINT = useNewBackendEndpoint
    ? "https://api.gatewayz.ai/v2/models"
    : "https://api.gatewayz.ai/v1/models";

  try {
    const response = await fetch(API_ENDPOINT);
    const data = await response.json();

    return {
      data,
      endpoint: API_ENDPOINT,
    };
  } catch (error) {
    console.error("Failed to fetch from backend:", error);
    throw error;
  }
}

// ============================================================================
// Example 5: Progressive Feature Rollout
// ============================================================================

export async function ProgressiveRolloutExample() {
  // This flag might be enabled for only a percentage of users in Statsig
  const showNewCheckoutFlow = await createFeatureFlag("new_checkout_flow_rollout")();

  return (
    <div>
      <h1>Checkout</h1>

      {showNewCheckoutFlow ? (
        // New checkout experience (rolled out to X% of users)
        <NewCheckoutComponent />
      ) : (
        // Stable checkout experience
        <StableCheckoutComponent />
      )}
    </div>
  );
}

// ============================================================================
// Example 6: A/B Testing Different Variants
// ============================================================================

export async function ABTestingExample() {
  // Check multiple variants for A/B testing
  const useVariantA = await createFeatureFlag("pricing_page_variant_a")();
  const useVariantB = await createFeatureFlag("pricing_page_variant_b")();

  let pricingLayout;

  if (useVariantA) {
    pricingLayout = <PricingLayoutA />;
  } else if (useVariantB) {
    pricingLayout = <PricingLayoutB />;
  } else {
    pricingLayout = <PricingLayoutControl />;
  }

  return (
    <div>
      <h1>Pricing</h1>
      {pricingLayout}
    </div>
  );
}

// ============================================================================
// Example 7: Feature Flag with Fallback
// ============================================================================

export async function FeatureFlagWithFallbackExample() {
  let enableExperimentalFeature = false;

  try {
    enableExperimentalFeature = await createFeatureFlag("experimental_feature")();
  } catch (error) {
    // If flag check fails, default to false
    console.error("Failed to check feature flag:", error);
    enableExperimentalFeature = false;
  }

  return (
    <div>
      {enableExperimentalFeature && <ExperimentalFeatureComponent />}
    </div>
  );
}

// ============================================================================
// Example 8: Combining Flags with User Permissions
// ============================================================================

export async function CombinedFlagsAndPermissionsExample({
  userPlan,
}: {
  userPlan: "free" | "pro" | "enterprise";
}) {
  const enablePremiumFeatures = await createFeatureFlag("premium_features_v2")();

  // Combine feature flag with user permission check
  const showPremiumContent = enablePremiumFeatures && userPlan !== "free";

  return (
    <div>
      <h1>Features</h1>

      {showPremiumContent ? (
        <div>
          <h2>Premium Features (V2)</h2>
          <PremiumFeaturesComponent />
        </div>
      ) : (
        <div>
          <h2>Standard Features</h2>
          <StandardFeaturesComponent />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Helper Components (Mock implementations)
// ============================================================================

function MainContent() {
  return <div>Main Content</div>;
}

function AdvancedAnalyticsDashboard() {
  return <div>Advanced Analytics Dashboard</div>;
}

function NewPricingDisplay() {
  return <div>New Pricing UI</div>;
}

function LegacyPricingDisplay() {
  return <div>Legacy Pricing UI</div>;
}

function NewCheckoutComponent() {
  return <div>New Checkout Flow</div>;
}

function StableCheckoutComponent() {
  return <div>Stable Checkout Flow</div>;
}

function PricingLayoutA() {
  return <div>Pricing Layout A</div>;
}

function PricingLayoutB() {
  return <div>Pricing Layout B</div>;
}

function PricingLayoutControl() {
  return <div>Pricing Layout Control</div>;
}

function ExperimentalFeatureComponent() {
  return <div>Experimental Feature</div>;
}

function PremiumFeaturesComponent() {
  return <div>Premium Features</div>;
}

function StandardFeaturesComponent() {
  return <div>Standard Features</div>;
}

async function getRecommendationsV1() {
  return ["item1", "item2", "item3"];
}

async function getRecommendationsV2() {
  return ["item1", "item2", "item3", "item4"];
}
