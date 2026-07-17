import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/app/api/middleware/error-handler';
import Stripe from 'stripe';

export async function POST(req: NextRequest) {
  try {
    // Check if Stripe is configured
    if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
      console.error('Stripe is not fully configured');
      // Return 200 to prevent retries, but log the error
      return NextResponse.json(
        { error: 'Stripe is not configured', received: true },
        { status: 200 }
      );
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-10-29.clover',
    });

    // Get the raw body for signature verification
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      console.error('No Stripe signature found in webhook request');
      // Return 200 to prevent retries, but log the error
      return NextResponse.json(
        { error: 'No signature', received: true },
        { status: 200 }
      );
    }

    // Verify the webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      // Return 200 to prevent retries for invalid signatures
      return NextResponse.json(
        { error: 'Invalid signature', received: true },
        { status: 200 }
      );
    }

    console.log('Received Stripe webhook event:', event.type);

    // Handle the checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;

      console.log('Checkout session completed:', {
        sessionId: session.id,
        customerId: session.customer,
        metadata: session.metadata,
      });

      // Get the amount of credits and user info from metadata
      const credits = session.metadata?.credits || session.metadata?.credits_cents;
      const userId = session.metadata?.userId || session.metadata?.user_id;
      const sessionId = session.metadata?.session_id || session.id;
      const paymentId = session.metadata?.payment_id;
      const userEmail = session.metadata?.userEmail || session.customer_email || session.customer_details?.email;
      const tier = session.metadata?.tier; // Capture tier for subscription tracking
      const checkoutType = session.metadata?.checkout_type; // 'subscription' or 'one_time'

      // Log full metadata for debugging
      console.log('Checkout session metadata:', {
        metadataKeys: Object.keys(session.metadata || {}),
        session_id: sessionId,
        user_id: userId,
        credits,
        payment_id: paymentId,
        customer_email: userEmail,
        tier,
        checkout_type: checkoutType,
      });

      if (!credits) {
        console.warn('No credits found in session metadata for checkout session', session.id);
        // Return 200 since this is expected for some sessions
        return NextResponse.json(
          { error: 'No credits in metadata', received: true },
          { status: 200 }
        );
      }

      if (!userId && !userEmail) {
        console.warn('No user ID or email found in session', session.id);
        // Return 200 but log for investigation
        return NextResponse.json(
          { error: 'No user identification', received: true },
          { status: 200 }
        );
      }

      console.log(`Checkout completed for user ${userId || userEmail} (${credits} credits, tier=${tier ?? 'n/a'}) — crediting handled by backend /api/stripe/webhook`);

      // NOTE: This proxy previously POSTed to `${API_BASE_URL}/user/credits` to
      // sync the credit, but that endpoint never existed on the backend (404,
      // silently swallowed — the catch below just logged and returned 200). The
      // backend's own Stripe webhook (src/routes/payments.py) is registered
      // directly with Stripe and performs the real crediting from this same
      // checkout.session.completed event. Do not re-add a client-side credit
      // sync call here.
    } else {
      // Log unhandled event types but still return 200
      console.info('Unhandled Stripe webhook event type:', event.type);
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error('Unexpected error in Stripe webhook:', error);
    // Always return 200 to prevent Stripe retries
    // The error is logged for investigation
    return NextResponse.json(
      { error: 'Internal server error', received: true },
      { status: 200 }
    );
  }
}
