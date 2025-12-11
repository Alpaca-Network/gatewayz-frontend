import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const contactFormSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  company: z.string().optional(),
  subject: z.enum(['general', 'sales', 'support', 'partnership', 'enterprise']),
  message: z.string().min(10, 'Message must be at least 10 characters').max(5000, 'Message must be less than 5000 characters'),
});

const subjectLabels: Record<string, string> = {
  general: 'General Inquiry',
  sales: 'Sales & Pricing',
  support: 'Technical Support',
  partnership: 'Partnership Opportunities',
  enterprise: 'Enterprise Solutions',
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate the request body
    const validationResult = contactFormSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid form data', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { name, email, company, subject, message } = validationResult.data;
    const subjectLabel = subjectLabels[subject] || subject;

    // Try to send via backend API
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.gatewayz.ai';

    try {
      const response = await fetch(`${apiBaseUrl}/v1/contact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: 'sales@gatewayz.ai',
          from_name: name,
          from_email: email,
          company: company || 'Not provided',
          subject: `[${subjectLabel}] Contact Form Submission from ${name}`,
          message: message,
          metadata: {
            source: 'beta.gatewayz.ai',
            subject_category: subject,
            timestamp: new Date().toISOString(),
          },
        }),
      });

      if (response.ok) {
        return NextResponse.json({
          success: true,
          message: 'Your message has been sent successfully.'
        });
      }

      // If backend API doesn't have contact endpoint, log and still return success
      // This ensures the user has a good experience while we can monitor logs
      console.warn('[Contact Form] Backend API contact endpoint not available, logging submission:', {
        name,
        email,
        company,
        subject: subjectLabel,
        messageLength: message.length,
        timestamp: new Date().toISOString(),
      });
    } catch (apiError) {
      // Log the error but don't fail the request
      console.error('[Contact Form] Failed to send to backend API:', apiError);
    }

    // Log the contact form submission for manual processing
    // In production, this should be sent to a monitoring service or database
    console.log('[Contact Form Submission]', {
      to: 'sales@gatewayz.ai',
      from: `${name} <${email}>`,
      company: company || 'Not provided',
      subject: `[${subjectLabel}] Contact Form Submission`,
      message: message,
      timestamp: new Date().toISOString(),
    });

    // Return success - the form data is logged and can be processed
    return NextResponse.json({
      success: true,
      message: 'Your message has been received. We will get back to you soon.'
    });

  } catch (error) {
    console.error('[Contact Form] Error processing contact form:', error);
    return NextResponse.json(
      { error: 'Failed to process your request. Please try again later.' },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({ status: 'ok', endpoint: 'contact' });
}
