import type { Metadata } from 'next';
import { InboxLayoutClient } from '../inbox/inbox-layout-client';

export const metadata: Metadata = {
  title: 'Code - AI Coding Agents | Gatewayz x Terragon',
  description: 'Delegate coding tasks to AI background agents. Run coding agents in parallel inside remote sandboxes with Claude Code, Codex, and more.',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://gatewayz.ai/code',
    siteName: 'Gatewayz',
    title: 'Code - AI Coding Agents | Gatewayz x Terragon',
    description: 'Delegate coding tasks to AI background agents. Run coding agents in parallel inside remote sandboxes with Claude Code, Codex, and more.',
    images: [
      {
        url: 'https://beta.gatewayz.ai/og-inbox.jpg',
        width: 1200,
        height: 630,
        alt: 'Gatewayz Code - AI Coding Agents',
        type: 'image/jpeg',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Code - AI Coding Agents | Gatewayz x Terragon',
    description: 'Delegate coding tasks to AI background agents. Run coding agents in parallel inside remote sandboxes with Claude Code, Codex, and more.',
    images: ['https://beta.gatewayz.ai/og-inbox.jpg'],
    creator: '@gatewayz_ai',
  },
};

/**
 * Code layout - uses the same client layout as inbox for full-height embedding.
 */
export default function CodeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <InboxLayoutClient>{children}</InboxLayoutClient>;
}
