import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

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

    const { email, cancelImmediately } = await req.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

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

    // Get active subscriptions for this customer
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: 'active',
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 404 }
      );
    }

    const subscription = subscriptions.data[0];

    // Access current_period_end - using type assertion for API version compatibility
    const currentPeriodEnd = (subscription as unknown as { current_period_end: number }).current_period_end;
    const periodEnd = new Date(currentPeriodEnd * 1000);

    let cancelledSubscription;

    if (cancelImmediately) {
      // Cancel immediately - user loses access right away
      cancelledSubscription = await stripe.subscriptions.cancel(subscription.id);
    } else {
      // Cancel at period end - user keeps access until billing period ends
      cancelledSubscription = await stripe.subscriptions.update(subscription.id, {
        cancel_at_period_end: true,
        metadata: {
          cancelled_at: new Date().toISOString(),
          downgraded_to: 'basic',
        },
      });
    }

    console.log('[Stripe Cancel] Subscription cancelled:', {
      subscriptionId: cancelledSubscription.id,
      cancelImmediately,
      periodEnd: periodEnd.toISOString(),
    });

    return NextResponse.json({
      success: true,
      subscriptionId: cancelledSubscription.id,
      cancelledImmediately: cancelImmediately || false,
      accessUntil: cancelImmediately ? null : periodEnd.toISOString(),
      message: cancelImmediately
        ? 'Your subscription has been cancelled.'
        : `Your subscription will be cancelled on ${periodEnd.toLocaleDateString()}. You'll have access until then.`,
    });
  } catch (error) {
    console.error('Stripe cancel error:', error);

    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode || 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to cancel subscription' },
      { status: 500 }
    );
  }
}
