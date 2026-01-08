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
    description: 'Perfect for experimenting',
    price: '$0',
    priceValue: 0,
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
    features: [
      '$10 free credits monthly',
      'Access to 5+ models',
      'Community support',
      'Basic analytics',
    ],
    ctaText: 'Get Started',
    ctaVariant: 'default',
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    description: 'Scale with confidence',
    price: '$10',
    priceValue: 10,
    originalPrice: '$20/month',
    discount: 'Save 50%',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    features: [
      '50% discount on first $10 credits',
      'Access to 10,000+ models',
      'Smart cost optimization',
      'Advanced analytics',
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
    price: '$75',
    priceValue: 75,
    originalPrice: '$150/month',
    discount: 'Save 50%',
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
    features: [
      '50% discount on $150 credits',
      '10x more usage than Pro',
      'Higher output limits for all tasks',
      'Early access to advanced features',
    ],
    ctaText: 'Get Started',
    ctaVariant: 'secondary',
    popular: true,
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_MAX_PRICE_ID,
    stripeProductId: 'prod_TKOraBpWMxMAIu',
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Tailored for scale',
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
    ctaText: 'Contact Sales',
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
};

// Helper to get tier configs as array for iteration
export const pricingTiers = Object.values(tierConfigs);

// Helper to get credit packages as array for iteration
export const creditPackagesList = Object.values(creditPackages);
