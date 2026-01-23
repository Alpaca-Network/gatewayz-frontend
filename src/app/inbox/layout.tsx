import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Agent Inbox | Gatewayz x Terragon',
  description: 'AI Agent Inbox - Intelligent automation powered by Gatewayz and Terragon partnership.',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://beta.gatewayz.ai/inbox',
    siteName: 'Gatewayz',
    title: 'AI Agent Inbox | Gatewayz x Terragon',
    description: 'AI Agent Inbox - Intelligent automation powered by Gatewayz and Terragon partnership.',
    images: [
      {
        url: '/og-inbox.jpg',
        width: 1200,
        height: 630,
        alt: 'Gatewayz x Terragon - AI Agent Inbox',
        type: 'image/jpeg',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI Agent Inbox | Gatewayz x Terragon',
    description: 'AI Agent Inbox - Intelligent automation powered by Gatewayz and Terragon partnership.',
    images: ['/og-inbox.jpg'],
    creator: '@gatewayz_ai',
  },
};

// Re-export the agent layout to ensure consistent behavior
export { default } from '../agent/layout';
