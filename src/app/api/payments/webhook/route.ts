import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/app/api/middleware/error-handler';
import Stripe from 'stripe';

export async function POST(req: NextRequest) {
  try {
    // Check if Stripe is configured
    if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
      console.error('[Payments Webhook] Stripe is not fully configured');
      return NextResponse.json(
        { error: 'Stripe is not configured' },
        { status: 503 }
      );
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-10-29.clover',
    });

    // Get the raw body for signature verification
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      console.error('[Payments Webhook] No Stripe signature found in request');
      return NextResponse.json(
        { error: 'No signature' },
        { status: 400 }
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
      console.error('[Payments Webhook] Webhook signature verification failed:', err);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    console.log('[Payments Webhook] Received Stripe webhook event:', event.type);

    // Handle the checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;

      console.log('[Payments Webhook] Checkout session completed:', {
        sessionId: session.id,
        customerId: session.customer,
        metadata: session.metadata,
      });

      // Get the amount of credits and user info from metadata
      const credits = session.metadata?.credits;
      const userId = session.metadata?.userId || session.metadata?.user_id; // Support both userId and user_id
      const userEmail = session.metadata?.userEmail || session.customer_email || session.customer_details?.email;

      if (!credits) {
        console.error('[Payments Webhook] No credits found in session metadata');
        return NextResponse.json(
          { error: 'No credits in metadata' },
          { status: 400 }
        );
      }

      if (!userId && !userEmail) {
        console.error('[Payments Webhook] No user ID or email found in session');
        return NextResponse.json(
          { error: 'No user identification' },
          { status: 400 }
        );
      }

      console.log(`[Payments Webhook] Checkout completed for user ${userId || userEmail} (${credits} credits) — crediting handled by backend /api/stripe/webhook`);

      // NOTE: This proxy previously POSTed to `${API_BASE_URL}/user/credits` to
      // sync the credit, but that endpoint never existed on the backend (404,
      // silently swallowed below) — a dead no-op. The backend's own Stripe
      // webhook (src/routes/payments.py) is registered directly with Stripe and
      // performs the real crediting from this same checkout.session.completed
      // event. Do not re-add a client-side credit sync call here.
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    return handleApiError(error, 'Payments Webhook');
  }
}
