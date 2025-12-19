"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Check, Sparkles } from "lucide-react";
import { useState } from "react";
import { getUserData } from "@/lib/api";

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
      '$10 free credits monthly',
      'Access to 5+ models',
      'Community support',
      'Basic analytics',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'Scale with confidence',
    price: '$10',
    originalPrice: '$20/month',
    discount: 'Save 50%',
    ctaText: 'Get Started',
    ctaVariant: 'default',
    features: [
      '50% discount on first $10 credits',
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
    ctaText: 'Contact Sales',
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

export function PricingSection() {
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const handleGetStarted = async (tier: PricingTier) => {
    setIsLoading(tier.id);

    try {
      if (tier.id === 'starter') {
        // Redirect to signup or show auth modal
        window.location.href = '/signup';
        return;
      }

      if (tier.id === 'enterprise') {
        // Open contact form or email
        window.location.href = 'mailto:sales@gatewayz.ai?subject=Enterprise Inquiry';
        return;
      }

      // For Pro and Max tiers, handle subscription checkout
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

      // Redirect to checkout page for analytics tracking
      // The checkout page will handle the actual Stripe redirect
      window.location.href = `/checkout?type=subscription&tier=${tier.id}&priceId=${tier.stripePriceId}&productId=${tier.stripeProductId}`;
    } catch (error) {
      console.error('Subscription error:', error);
      alert(error instanceof Error ? error.message : 'Failed to start subscription. Please try again.');
    } finally {
      setIsLoading(null);
    }
  };

  return (
    <div className="w-full py-20 bg-white">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-12 space-y-3">
          <h2 className="text-4xl sm:text-5xl font-bold text-foreground">Simple Pricing</h2>
          <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
            Gatewayz is a universal inference engine providing access to 10,000+ models. One API at the lowest cost. Try now with free credits today.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {pricingTiers.map((tier) => (
            <Card
              key={tier.id}
              className={`relative flex flex-col ${
                tier.popular
                  ? 'border-primary border-2 shadow-lg scale-105'
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
                <Button
                  className={`w-full ${
                    tier.popular
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                      : tier.ctaVariant === 'secondary'
                      ? ''
                      : 'bg-black dark:bg-white text-white dark:text-black hover:bg-black/90 dark:hover:bg-white/90'
                  }`}
                  variant={tier.popular ? 'default' : tier.ctaVariant}
                  size="lg"
                  onClick={() => handleGetStarted(tier)}
                  disabled={isLoading !== null}
                >
                  {isLoading === tier.id ? 'Loading...' : tier.ctaText}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
