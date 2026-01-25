import type { Metadata } from 'next';
import { redbeardMetadata } from './metadata';

export const metadata: Metadata = redbeardMetadata;

export default function RedbeardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
