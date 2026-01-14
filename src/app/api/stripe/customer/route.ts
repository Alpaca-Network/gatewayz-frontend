import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/app/api/middleware/error-handler';
import Stripe from 'stripe';

export async function GET(req: NextRequest) {
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

    // Get user email from query params
    const email = req.nextUrl.searchParams.get('email');

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
      return NextResponse.json({
        customer: null,
        paymentMethods: [],
        billingAddress: null,
      });
    }

    const customer = customers.data[0];

    // Get payment methods for this customer
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customer.id,
      type: 'card',
    });

    // Get billing address from customer
    const billingAddress = customer.address ? {
      line1: customer.address.line1,
      line2: customer.address.line2,
      city: customer.address.city,
      state: customer.address.state,
      postal_code: customer.address.postal_code,
      country: customer.address.country,
    } : null;

    return NextResponse.json({
      customer: {
        id: customer.id,
        email: customer.email,
        name: customer.name,
      },
      paymentMethods: paymentMethods.data.map(pm => ({
        id: pm.id,
        brand: pm.card?.brand,
        last4: pm.card?.last4,
        exp_month: pm.card?.exp_month,
        exp_year: pm.card?.exp_year,
      })),
      billingAddress,
    });
  } catch (error) {
    return handleApiError(error, 'Stripe Customer API');
  }
}
