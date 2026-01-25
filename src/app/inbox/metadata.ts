import type { Metadata } from 'next';

export const inboxMetadata: Metadata = {
  title: 'AI Agent Inbox - Gatewayz x Terragon',
  description: 'AI-powered coding agent inbox. Review PRs, manage code changes, and collaborate with AI agents to streamline your development workflow.',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://gatewayz.ai/inbox',
    siteName: 'Gatewayz',
    title: 'AI Agent Inbox - Gatewayz x Terragon',
    description: 'AI-powered coding agent inbox. Review PRs, manage code changes, and collaborate with AI agents to streamline your development workflow.',
    images: [
      {
        url: '/inbox-og-image.png',
        width: 1200,
        height: 630,
        alt: 'AI Agent Inbox - Gatewayz x Terragon',
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI Agent Inbox - Gatewayz x Terragon',
    description: 'AI-powered coding agent inbox. Review PRs, manage code changes, and collaborate with AI agents to streamline your development workflow.',
    images: ['/inbox-og-image.png'],
    creator: '@gatewayz_ai',
  },
};
