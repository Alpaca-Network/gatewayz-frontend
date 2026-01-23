import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Claude Code + GatewayZ | Gatewayz x Terragon',
  description: 'Use Claude Code with GatewayZ for smart AI routing, cost optimization, and access to 10+ models.',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://beta.gatewayz.ai/code',
    siteName: 'Gatewayz',
    title: 'Claude Code + GatewayZ | Gatewayz x Terragon',
    description: 'Use Claude Code with GatewayZ for smart AI routing, cost optimization, and access to 10+ models.',
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
    title: 'Claude Code + GatewayZ | Gatewayz x Terragon',
    description: 'Use Claude Code with GatewayZ for smart AI routing, cost optimization, and access to 10+ models.',
    images: ['/og-inbox.jpg'],
    creator: '@gatewayz_ai',
  },
};

export default function CodeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
