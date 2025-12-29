import { loadStripe, Stripe } from '@stripe/stripe-js';
import { getApiKey } from './api';

let stripePromise: Promise<Stripe | null>;

export const getStripe = () => {
  if (!stripePromise) {
    stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
  }
  return stripePromise;
};

export const redirectToCheckout = async (
  amount: number,
  userEmail?: string,
  userId?: number,
  creditValue?: number // Optional: credits to add (if different from amount due to discounts)
) => {
  try {
    // Get API key from localStorage
    const apiKey = getApiKey();

    const sanitizedEmail =
      typeof userEmail === 'string' && !userEmail.startsWith('did:privy:') && userEmail.includes('@')
        ? userEmail
        : undefined;

    console.log('Checkout - API key exists:', !!apiKey);
    console.log('Checkout - Amount:', amount);
    console.log('Checkout - Credit value:', creditValue || amount);
    console.log('Checkout - User email:', sanitizedEmail || 'not provided');
    console.log('Checkout - User ID:', userId);

    if (!apiKey) {
      throw new Error('You must be logged in to purchase credits');
    }

    // Create checkout session
    const response = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount,
        creditValue: creditValue || amount, // Credits to add to account
        userEmail: sanitizedEmail,
        userId,
        apiKey, // Pass API key to the route handler
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.log('Stripe checkout error response:', errorData);
      console.log('Response status:', response.status);
      throw new Error(errorData.error || 'Failed to create checkout session');
    }

    const data = await response.json();
    console.log('Checkout response data:', data);

    // Redirect to Stripe Checkout
    if (data.url) {
      console.log('Redirecting to:', data.url);
      window.location.href = data.url;
    } else {
      throw new Error('No checkout URL received from server');
    }
  } catch (error) {
    console.log('Error redirecting to checkout:', error);
    throw error;
  }
};
