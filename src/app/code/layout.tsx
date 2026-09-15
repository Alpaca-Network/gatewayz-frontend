import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Claude Code + GatewayZ',
  description: 'Use Claude Code with GatewayZ on one key — native Anthropic Messages, plus models from OpenAI, xAI, Moonshot and Meta.',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://beta.gatewayz.ai/code',
    siteName: 'Gatewayz',
    title: 'Claude Code + GatewayZ',
    description: 'Use Claude Code with GatewayZ on one key — native Anthropic Messages, plus models from OpenAI, xAI, Moonshot and Meta.',
    images: [
      {
        url: 'https://beta.gatewayz.ai/og-inbox.jpg',
        width: 1200,
        height: 630,
        alt: 'Claude Code + GatewayZ',
        type: 'image/jpeg',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Claude Code + GatewayZ',
    description: 'Use Claude Code with GatewayZ on one key — native Anthropic Messages, plus models from OpenAI, xAI, Moonshot and Meta.',
    images: ['https://beta.gatewayz.ai/og-inbox.jpg'],
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
