"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Check, Sparkles } from "lucide-react";
import { useState, useMemo } from "react";
import { getUserData } from "@/lib/api";
import { useTier } from "@/hooks/use-tier";

interface PricingTier {
  id: 'starter' | 'pro' | 'max' | 'enterprise';
  name: string;
  description: string;
  price: string;
  originalPrice?: string;
  discount?: string;
  ctaText: string;
  ctaVariant?: 'default' | 'secondary';
  popular?: boolean;
  features: string[];
  stripePriceId?: string; // Stripe Price ID for subscription
  stripeProductId?: string; // Stripe Product ID to store in database
}

const pricingTiers: PricingTier[] = [
  {
    id: 'starter',
    name: 'Starter',
    description: 'Perfect for experimenting',
    price: '$0',
    ctaText: 'Get Started',
    ctaVariant: 'default',
    features: [
      '$3 free credits monthly',
      'Access to 5+ models',
      'Community support',
      'Basic analytics',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'Scale with confidence',
    price: '$8',
    originalPrice: '$10/month',
    discount: 'Save 20%',
    ctaText: 'Get Started',
    ctaVariant: 'default',
    features: [
      '$15 monthly credit allowance',
      'Access to 10,000+ models',
      'Smart cost optimization',
      'Advanced analytics',
      'Priority support',
      '99.9% uptime SLA',
    ],
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID,
    stripeProductId: 'prod_TKOqQPhVRxNp4Q', // Pro product ID for database
  },
  {
    id: 'max',
    name: 'Max',
    description: 'Higher limits, priority access',
    price: '$75',
    originalPrice: '$150/month',
    discount: 'Save 50%',
    ctaText: 'Get Started',
    ctaVariant: 'secondary',
    popular: true,
    features: [
      '50% discount on $150 credits',
      '10x more usage than Pro',
      'Higher output limits for all tasks',
      'Early access to advanced features',
    ],
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_MAX_PRICE_ID,
    stripeProductId: 'prod_TKOraBpWMxMAIu', // Max product ID for database
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Tailored for scale',
    price: 'Custom',
    ctaText: 'Get Started',
    ctaVariant: 'default',
    features: [
      'Dedicated infrastructure',
      'Custom model training',
      'White-label options',
      '24/7 dedicated support',
      '99.99% uptime SLA',
    ],
  },
];

// Tier hierarchy for comparison (higher number = higher tier)
const TIER_HIERARCHY: Record<string, number> = {
  starter: 0,
  basic: 0,  // basic and starter are same level
  pro: 1,
  max: 2,
  enterprise: 3,
};

type ButtonAction = 'your_plan' | 'upgrade' | 'downgrade' | 'get_started' | 'contact';

export function PricingSection() {
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const { tier: currentTier, hasSubscription } = useTier();

  // Determine button action for each tier
  const getButtonAction = useMemo(() => {
    return (tierId: string): ButtonAction => {
      // Enterprise is always contact
      if (tierId === 'enterprise') {
        return 'contact';
      }

      // If user is not authenticated or doesn't have a subscription, show "Get Started"
      const userData = getUserData();
      if (!userData || !userData.api_key) {
        return 'get_started';
      }

      // Map current tier to hierarchy (basic = starter level)
      const normalizedCurrentTier = currentTier === 'basic' ? 'starter' : currentTier;
      const currentLevel = TIER_HIERARCHY[normalizedCurrentTier] ?? 0;
      const targetLevel = TIER_HIERARCHY[tierId] ?? 0;

      // Same tier = Your Plan
      if (targetLevel === currentLevel) {
        return 'your_plan';
      }

      // Higher tier = Upgrade
      if (targetLevel > currentLevel) {
        return 'upgrade';
      }

      // Lower tier = Downgrade
      return 'downgrade';
    };
  }, [currentTier, hasSubscription]);

  // Get button text based on action
  const getButtonText = (tierId: string, action: ButtonAction): string => {
    switch (action) {
      case 'your_plan':
        return 'Your Plan';
      case 'upgrade':
        return 'Upgrade';
      case 'downgrade':
        return 'Downgrade';
      case 'contact':
        return 'Contact Sales';
      default:
        return 'Get Started';
    }
  };

  const handleTierAction = async (tier: PricingTier) => {
    const action = getButtonAction(tier.id);
    setIsLoading(tier.id);

    try {
      // "Your Plan" button does nothing
      if (action === 'your_plan') {
        return;
      }

      if (tier.id === 'starter') {
        // Redirect to signup for unauthenticated users
        const userData = getUserData();
        if (!userData || !userData.api_key) {
          window.location.href = '/signup';
          return;
        }
        // Authenticated user clicking starter - this is a downgrade (cancel subscription)
        if (action === 'downgrade') {
          // Redirect to checkout with cancel action
          window.location.href = `/checkout?tier=starter&mode=subscription&action=cancel`;
          return;
        }
        return;
      }

      if (action === 'get_started') {
        // Redirect to signup for unauthenticated users
        const userData = getUserData();
        if (!userData || !userData.api_key) {
          window.location.href = '/signup';
          return;
        }
        return;
      }

      if (tier.id === 'enterprise' || action === 'contact') {
        // Redirect to enterprise page
        window.location.href = 'https://gatewayz.ai/enterprise';
        return;
      }

      // For Pro and Max tiers, check authentication
      const userData = getUserData();

      if (!userData || !userData.api_key) {
        alert('Please sign in to subscribe');
        window.location.href = '/signup';
        return;
      }

      if (!tier.stripePriceId) {
        alert('Subscription not configured. Please contact support.');
        return;
      }

      // Upgrade: redirect to checkout page with upgrade flag
      if (action === 'upgrade') {
        window.location.href = `/checkout?tier=${tier.id}&mode=subscription&action=upgrade`;
        return;
      }

      // Downgrade: redirect to checkout with downgrade flag
      if (action === 'downgrade') {
        window.location.href = `/checkout?tier=${tier.id}&mode=subscription&action=downgrade`;
        return;
      }

      // Default: new subscription
      window.location.href = `/checkout?tier=${tier.id}&mode=subscription`;
    } catch (error) {
      console.error('Subscription error:', error);
      alert(error instanceof Error ? error.message : 'Failed to process request. Please try again.');
    } finally {
      setIsLoading(null);
    }
  };

  return (
    <div className="w-full py-8 sm:py-12 lg:py-20 bg-white">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-12 space-y-3">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground">Simple Pricing</h2>
          <p className="text-muted-foreground text-sm sm:text-base lg:text-lg max-w-2xl mx-auto leading-relaxed px-2">
            Gatewayz is a universal inference engine providing access to 10,000+ models. One API at the lowest cost. Try now with free credits today.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {pricingTiers.map((tier) => (
            <Card
              key={tier.id}
              className={`relative flex flex-col ${
                tier.popular
                  ? 'border-primary border-2 shadow-lg md:scale-105'
                  : 'border-border'
              }`}
            >
              {tier.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-medium flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  Most Popular
                </div>
              )}

              <CardContent className="flex flex-col flex-1 p-6">
                {/* Tier Name & Description */}
                <div className="mb-4">
                  <h3 className="text-xl font-bold mb-1">{tier.name}</h3>
                  <p className="text-sm text-muted-foreground">{tier.description}</p>
                </div>

                {/* Pricing */}
                <div className="mb-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold">{tier.price}</span>
                    {tier.price !== 'Custom' && tier.price !== '$0' && (
                      <span className="text-muted-foreground">/month</span>
                    )}
                  </div>
                  {tier.price === '$0' && (
                    <p className="text-sm text-muted-foreground mt-1">Get started with free credits</p>
                  )}
                  {tier.originalPrice && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm text-muted-foreground line-through">{tier.originalPrice}</span>
                      {tier.discount && (
                        <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full font-medium">
                          {tier.discount}
                        </span>
                      )}
                    </div>
                  )}
                  {tier.id === 'pro' && (
                    <p className="text-sm text-muted-foreground mt-2">Only pay for what you use</p>
                  )}
                  {tier.id === 'max' && (
                    <p className="text-sm text-muted-foreground mt-2">Everything in Pro, plus enhanced limits</p>
                  )}
                  {tier.id === 'enterprise' && (
                    <p className="text-sm text-muted-foreground mt-2">Solutions for large organizations</p>
                  )}
                </div>

                {/* Features */}
                <div className="flex-1 space-y-3 my-6">
                  {tier.features.map((feature, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </div>
                  ))}
                </div>

                {/* CTA Button */}
                {(() => {
                  const action = getButtonAction(tier.id);
                  const buttonText = getButtonText(tier.id, action);
                  const isCurrentPlan = action === 'your_plan';
                  const isDowngrade = action === 'downgrade';

                  return (
                    <Button
                      className={`w-full ${
                        isCurrentPlan
                          ? 'bg-green-600 text-white hover:bg-green-700 cursor-default'
                          : isDowngrade
                          ? 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
                          : tier.popular
                          ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                          : tier.ctaVariant === 'secondary'
                          ? ''
                          : 'bg-black dark:bg-white text-white dark:text-black hover:bg-black/90 dark:hover:bg-white/90'
                      }`}
                      variant={isCurrentPlan ? 'default' : isDowngrade ? 'secondary' : tier.popular ? 'default' : tier.ctaVariant}
                      size="lg"
                      onClick={() => !isCurrentPlan && handleTierAction(tier)}
                      disabled={isLoading !== null || isCurrentPlan}
                    >
                      {isLoading === tier.id ? 'Loading...' : buttonText}
                    </Button>
                  );
                })()}

              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
