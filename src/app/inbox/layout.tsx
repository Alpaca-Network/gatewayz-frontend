import type { Metadata } from 'next';
import { inboxMetadata } from './metadata';
import { InboxLayoutClient } from './inbox-layout-client';

export const metadata: Metadata = inboxMetadata;

/**
 * Inbox layout (server component) that exports metadata for OG tags
 * and wraps the client-side layout for DOM manipulation.
 */
export default function InboxLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <InboxLayoutClient>{children}</InboxLayoutClient>;
}
