import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/app/api/middleware/error-handler';
import { API_BASE_URL } from '@/lib/config';
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
      apiVersion: '2025-09-30.clover',
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
      const credits = session.metadata?.credits;
      const userId = session.metadata?.userId || session.metadata?.user_id; // Support both userId and user_id
      const paymentId = session.metadata?.payment_id;
      const userEmail = session.metadata?.userEmail || session.customer_email || session.customer_details?.email;

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

      console.log(`Crediting ${credits} credits to user ${userId || userEmail}`);

      try {
        // Call your backend API to credit the user
        const response = await fetch(`${API_BASE_URL}/user/credits`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: userId ? parseInt(userId) : undefined,
            email: userEmail,
            credits: parseInt(credits),
            transaction_type: 'purchase',
            description: `Stripe payment - ${credits} credits`,
            stripe_session_id: session.id,
            payment_id: paymentId ? parseInt(paymentId) : undefined,
            amount: session.amount_total ? session.amount_total / 100 : undefined, // Convert cents to dollars
            stripe_payment_intent: session.payment_intent as string,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Failed to credit user:', {
            status: response.status,
            error: errorText,
            userId,
            credits,
            sessionId: session.id,
          });
          // Still return 200 to Stripe to prevent infinite retries
          return NextResponse.json(
            { error: 'Failed to credit user', received: true },
            { status: 200 }
          );
        }

        const result = await response.json();
        console.log('Successfully processed payment and credited user:', result);
      } catch (error) {
        console.error('Error crediting user:', error);
        // Return 200 to prevent retries - error is logged for manual review
        return NextResponse.json(
          { error: 'Error processing payment', received: true },
          { status: 200 }
        );
      }
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
