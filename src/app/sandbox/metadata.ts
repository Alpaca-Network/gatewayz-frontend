import type { Metadata } from 'next';

export const sandboxMetadata: Metadata = {
  title: 'Sandbox - Generate Apps with AI | Gatewayz',
  description: 'Generate apps with Gatewayz AI Sandbox. Build and prototype AI-powered applications in seconds.',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://beta.gatewayz.ai/sandbox',
    siteName: 'Gatewayz',
    title: 'Gatewayz Sandbox - Generate Apps with AI',
    description: 'Generate apps with Gatewayz AI Sandbox. Build and prototype AI-powered applications in seconds.',
    images: [
      {
        url: '/sandbox-og-image.png',
        width: 1200,
        height: 630,
        alt: 'Gatewayz Sandbox - Generate Apps with AI',
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Gatewayz Sandbox - Generate Apps with AI',
    description: 'Generate apps with Gatewayz AI Sandbox. Build and prototype AI-powered applications in seconds.',
    images: ['/sandbox-og-image.png'],
    creator: '@gatewayz_ai',
  },
};
