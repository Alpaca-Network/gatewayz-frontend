import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { amount, creditValue, userEmail, userId, apiKey, plan } = await req.json();

    const normalizedEmail = typeof userEmail === 'string' && userEmail.includes('@') && !userEmail.startsWith('did:privy:')
      ? userEmail
      : undefined;

    // Validate amount
    if (!amount || amount < 1) {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 }
      );
    }

    // Validate API key
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 401 }
      );
    }

    // creditValue is the actual credits to add (may be higher than amount if discounted)
    const creditsToAdd = creditValue || amount;

    // Call backend to create checkout session
    // Backend will create payment record and properly format metadata
    const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'https://api.gatewayz.ai';

    // Get the frontend URL - force beta.gatewayz.ai for Stripe redirects
    // The VERCEL_URL changes with each deployment, so we use a fixed URL
    const frontendUrl = 'https://beta.gatewayz.ai';

    // Description shows the credit value they receive (may differ from payment amount for discounted packages)
    const description = creditsToAdd !== amount
      ? `$${creditsToAdd} credits (discounted price: $${amount}) for Gatewayz AI platform`
      : `$${amount} credits for Gatewayz AI platform`;

    const requestBody = {
      amount: amount * 100, // Convert dollars to cents (payment amount)
      credit_value: creditsToAdd, // Credits to add to account (in dollars)
      currency: 'usd',
      description,
      customer_email: normalizedEmail,
      success_url: `${frontendUrl}/checkout/success?session_id={{CHECKOUT_SESSION_ID}}&tier=credits${plan ? `&plan=${encodeURIComponent(plan)}` : ''}`,
      cancel_url: `${frontendUrl}/settings/credits`,
    };

    console.log('[Checkout API] Frontend URL:', frontendUrl);
    console.log('[Checkout API] Success URL:', requestBody.success_url);

    console.log('[Checkout API] Calling backend checkout:', backendUrl);
    console.log('[Checkout API] Request body:', JSON.stringify(requestBody));
    console.log('[Checkout API] API key starts with:', apiKey?.substring(0, 7) || 'undefined');

    const response = await fetch(`${backendUrl}/api/stripe/checkout-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    console.log('[Checkout API] Backend response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.log('[Checkout API] Backend checkout error (raw):', errorText);

      let error;
      try {
        error = JSON.parse(errorText);
      } catch (e) {
        error = { detail: errorText };
      }

      console.log('[Checkout API] Backend checkout error (parsed):', error);
      return NextResponse.json(
        { error: error.detail || error.message || 'Failed to create checkout session' },
        { status: response.status }
      );
    }

    const session = await response.json();
    console.log('[Checkout API] Session created successfully:', session.session_id);
    return NextResponse.json({ sessionId: session.session_id, url: session.url });

  } catch (error) {
    console.log('Stripe checkout error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to create checkout session';
    return NextResponse.json(
      { error: errorMessage, details: String(error) },
      { status: 500 }
    );
  }
}
