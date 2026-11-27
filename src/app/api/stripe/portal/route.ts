import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { resolveAuthenticatedAccount } from '@/app/api/middleware/auth';
import { findAccountStripeCustomer } from '@/lib/server/stripe-account-customer';

export async function POST(req: NextRequest) {
  try {
    // Check if Stripe is configured
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: 'Stripe is not configured' },
        { status: 503 }
      );
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-10-29.clover',
    });

    // Resolve the caller's account from their API key — never trust
    // client-supplied identity, or anyone could open anyone else's billing portal.
    const auth = await resolveAuthenticatedAccount(req);
    if (auth.error) {
      return auth.error;
    }

    // The customer must belong to this account (stored id, or metadata.user_id);
    // an email match alone is not enough, since an account email can change.
    const customer = await findAccountStripeCustomer(stripe, auth.account);
    if (!customer) {
      return NextResponse.json(
        { error: 'No Stripe customer found' },
        { status: 404 }
      );
    }

    // Create a portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: customer.id,
      return_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/settings/account`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.log('Stripe portal error:', error);
    return NextResponse.json(
      { error: 'Failed to create portal session' },
      { status: 500 }
    );
  }
}
