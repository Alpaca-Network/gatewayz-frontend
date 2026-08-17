import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { resolveAuthenticatedEmail } from '@/app/api/middleware/auth';

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

    // Resolve the caller's email from their API key — never trust a
    // client-supplied email, or anyone could hijack anyone else's billing portal.
    const auth = await resolveAuthenticatedEmail(req);
    if (auth.error) {
      return auth.error;
    }
    const { email } = auth;

    // Search for customer by email
    const customers = await stripe.customers.list({
      email: email,
      limit: 1,
    });

    if (customers.data.length === 0) {
      return NextResponse.json(
        { error: 'No Stripe customer found' },
        { status: 404 }
      );
    }

    const customer = customers.data[0];

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
