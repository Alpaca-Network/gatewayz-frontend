/**
 * Shared pricing configuration for subscription tiers and credit packages.
 * Used by checkout page, pricing section, and other components.
 */

export interface TierConfig {
  id: 'starter' | 'pro' | 'max' | 'enterprise';
  name: string;
  description: string;
  price: string;
  priceValue: number;
  originalPrice?: string;
  discount?: string;
  color: string;
  bgColor: string;
  features: string[];
  ctaText: string;
  ctaVariant?: 'default' | 'secondary';
  popular?: boolean;
  stripePriceId?: string;
  stripeProductId?: string;
}

export interface CreditPackage {
  id: string;
  name: string;
  creditValue: number;
  price: number;
  discount: string;
  popular?: boolean;
}

export const tierConfigs: Record<string, TierConfig> = {
  starter: {
    id: 'starter',
    name: 'Starter',
    description: 'Perfect for getting started',
    price: '$35',
    priceValue: 35,
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
    features: [
      'Access to 10,000+ models',
      'Smart cost optimization',
      'Community support',
      'Basic analytics',
    ],
    ctaText: 'Get Started',
    ctaVariant: 'default',
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    description: 'Scale with confidence',
    price: '$120',
    priceValue: 120,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    features: [
      'Everything in Starter',
      'Access to 10,000+ models',
      'Smart cost optimization',
      'Terragon: Task inbox for AI coding agents',
      'Priority support',
      '99.9% uptime SLA',
    ],
    ctaText: 'Get Started',
    ctaVariant: 'default',
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID,
    stripeProductId: 'prod_TKOqQPhVRxNp4Q',
  },
  max: {
    id: 'max',
    name: 'Max',
    description: 'Higher limits, priority access',
    price: '$350',
    priceValue: 350,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
    features: [
      'Everything in Pro',
      '10x more usage than Pro',
      'Higher output limits for all tasks',
      'Early access to advanced features',
    ],
    ctaText: 'Get Started',
    ctaVariant: 'secondary',
    popular: true,
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_MAX_PRICE_ID,
    stripeProductId: 'prod_TMHUXL8p0onwwO',
  },
  enterprise: {
    id: 'enterprise',
    name: 'Custom',
    description: 'Tailored to your business',
    price: 'Custom',
    priceValue: 0,
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
    features: [
      'Dedicated infrastructure',
      'Custom model training',
      'White-label options',
      '24/7 dedicated support',
      '99.99% uptime SLA',
    ],
    ctaText: 'Book your audit',
    ctaVariant: 'default',
  },
};

export const creditPackages: Record<string, CreditPackage> = {
  tier1: {
    id: 'tier1',
    name: 'Starter',
    creditValue: 10,
    price: 9,
    discount: '10% off',
  },
  tier2: {
    id: 'tier2',
    name: 'Growth',
    creditValue: 100,
    price: 75,
    discount: '25% off',
    popular: true,
  },
  tier3: {
    id: 'tier3',
    name: 'Scale',
    creditValue: 250,
    price: 175,
    discount: '30% off',
  },
  custom: {
    id: 'custom',
    name: 'Custom',
    creditValue: 0, // Will be set dynamically
    price: 0, // Will be set dynamically
    discount: 'No discount',
  },
};

// Helper to get tier configs as array for iteration
export const pricingTiers = Object.values(tierConfigs);

// Helper to get credit packages as array for iteration
export const creditPackagesList = Object.values(creditPackages);
