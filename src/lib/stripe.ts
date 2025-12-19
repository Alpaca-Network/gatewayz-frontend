import { loadStripe, Stripe } from '@stripe/stripe-js';
import { getApiKey } from './api';

let stripePromise: Promise<Stripe | null>;

export const getStripe = () => {
  if (!stripePromise) {
    stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
  }
  return stripePromise;
};

/**
 * Redirect to the checkout page for analytics tracking before Stripe payment.
 * This allows Google Analytics, Google Ads, X Ads, etc. to track checkout initiation.
 */
export const redirectToCheckout = async (
  amount: number,
  userEmail?: string,
  userId?: number,
  creditValue?: number // Optional: credits to add (if different from amount due to discounts)
) => {
  try {
    // Get API key from localStorage
    const apiKey = getApiKey();

    console.log('Checkout - API key exists:', !!apiKey);
    console.log('Checkout - Amount:', amount);
    console.log('Checkout - Credit value:', creditValue || amount);
    console.log('Checkout - User ID:', userId);

    if (!apiKey) {
      throw new Error('You must be logged in to purchase credits');
    }

    // Redirect to checkout page for analytics tracking
    // The checkout page will handle the actual Stripe redirect
    const credits = creditValue || amount;
    window.location.href = `/checkout?type=credits&amount=${amount}&creditValue=${credits}`;
  } catch (error) {
    console.log('Error redirecting to checkout:', error);
    throw error;
  }
};

/**
 * Redirect to the checkout page for subscription purchase.
 * This allows analytics to track subscription checkout initiation.
 */
export const redirectToSubscriptionCheckout = (
  tier: 'pro' | 'max',
  priceId: string,
  productId: string
) => {
  window.location.href = `/checkout?type=subscription&tier=${tier}&priceId=${priceId}&productId=${productId}`;
};
