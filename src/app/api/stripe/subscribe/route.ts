import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { priceId, productId, userEmail, userId, apiKey, tier, plan } = await req.json();

    const normalizedEmail = typeof userEmail === 'string' && userEmail.includes('@') && !userEmail.startsWith('did:privy:')
      ? userEmail
      : undefined;

    // Validate price ID
    if (!priceId) {
      return NextResponse.json(
        { error: 'Price ID is required' },
        { status: 400 }
      );
    }

    // Validate product ID
    if (!productId) {
      return NextResponse.json(
        { error: 'Product ID is required' },
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

    // Call backend to create subscription checkout session
    const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'https://api.gatewayz.ai';

    // Get the frontend URL - force beta.gatewayz.ai for Stripe redirects
    const frontendUrl = 'https://beta.gatewayz.ai';

    const requestBody = {
      price_id: priceId,
      product_id: productId, // Stripe Product ID to store in database (prod_TKOqQPhVRxNp4Q or prod_TKOraBpWMxMAIu)
      customer_email: normalizedEmail,
      success_url: `${frontendUrl}/checkout/success?session_id={{CHECKOUT_SESSION_ID}}&tier=${tier || 'pro'}${plan ? `&plan=${encodeURIComponent(plan)}` : ''}`,
      cancel_url: `${frontendUrl}/settings/credits`,
      mode: 'subscription', // Subscription mode instead of payment
      ...(tier && { tier }), // Pass tier for subscription metadata tracking
    };

    console.log('[Subscribe API] Frontend URL:', frontendUrl);
    console.log('[Subscribe API] Success URL:', requestBody.success_url);
    console.log('[Subscribe API] Calling backend subscription:', backendUrl);
    console.log('[Subscribe API] Request body:', JSON.stringify(requestBody));
    console.log('[Subscribe API] API key starts with:', apiKey?.substring(0, 7) || 'undefined');

    const response = await fetch(`${backendUrl}/api/stripe/subscription-checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    console.log('[Subscribe API] Backend response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.log('[Subscribe API] Backend subscription error (raw):', errorText);

      let error;
      try {
        error = JSON.parse(errorText);
      } catch (e) {
        error = { detail: errorText };
      }

      console.log('[Subscribe API] Backend subscription error (parsed):', error);
      return NextResponse.json(
        { error: error.detail || error.message || 'Failed to create subscription session' },
        { status: response.status }
      );
    }

    const session = await response.json();
    console.log('[Subscribe API] Session created successfully:', session.session_id);
    return NextResponse.json({ sessionId: session.session_id, url: session.url });

  } catch (error) {
    console.log('Stripe subscription error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to create subscription session';
    return NextResponse.json(
      { error: errorMessage, details: String(error) },
      { status: 500 }
    );
  }
}
