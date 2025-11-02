import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/app/api/middleware/error-handler';
import { API_BASE_URL } from '@/lib/config';
import Stripe from 'stripe';

export async function POST(req: NextRequest) {
  try {
    // Check if Stripe is configured
    if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
      console.log('Stripe is not fully configured');
      return NextResponse.json(
        { error: 'Stripe is not configured' },
        { status: 503 }
      );
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-09-30.clover',
    });

    // Get the raw body for signature verification
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      console.log('No Stripe signature found');
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
      console.log('Webhook signature verification failed:', err);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
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
        console.log('No credits found in session metadata');
        return NextResponse.json(
          { error: 'No credits in metadata' },
          { status: 400 }
        );
      }

      if (!userId && !userEmail) {
        console.log('No user ID or email found in session');
        return NextResponse.json(
          { error: 'No user identification' },
          { status: 400 }
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
          throw new Error('Failed to credit user');
        }

        const result = await response.json();
        console.log('Successfully processed payment and credited user:', result);
      } catch (error) {
        console.error('Error crediting user:', error);
        // Still return success to Stripe to prevent infinite retries
        // The error is logged for manual review
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    return handleApiError(error, 'Stripe Webhook');
  }
}
