import { Metadata } from 'next';
import Link from 'next/link';
import { Mail, MessageSquare, BookOpen, Users, ArrowUpRight } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Support | Gatewayz',
  description: 'Get help with Gatewayz — contact support, browse documentation, or join the community.',
};

interface SupportChannel {
  title: string;
  description: string;
  href: string;
  cta: string;
  external?: boolean;
  icon: React.ComponentType<{ className?: string }>;
}

const channels: SupportChannel[] = [
  {
    title: 'Email support',
    description: 'Reach our team directly for account, billing, or technical questions.',
    href: 'mailto:support@gatewayz.ai',
    cta: 'support@gatewayz.ai',
    icon: Mail,
  },
  {
    title: 'Submit a request',
    description: 'Send us a detailed message and we’ll get back to you by email.',
    href: '/contact',
    cta: 'Open contact form',
    icon: MessageSquare,
  },
  {
    title: 'Documentation',
    description: 'Guides, API reference, and integration walkthroughs for building on Gatewayz.',
    href: 'https://docs.gatewayz.ai/',
    cta: 'Read the docs',
    external: true,
    icon: BookOpen,
  },
  {
    title: 'Community',
    description: 'Join our Discord to ask questions and share what you’re building.',
    href: 'https://discord.gg/TEZDnb9EHE',
    cta: 'Join Discord',
    external: true,
    icon: Users,
  },
];

export default function SupportPage() {
  return (
    <div className="min-h-[calc(100vh-130px)] bg-background pb-32" style={{ marginTop: '-65px' }}>
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8 pt-32">
        <header className="mb-10">
          <h1 className="text-4xl font-bold tracking-tight">Support</h1>
          <p className="mt-2 text-muted-foreground">
            Need a hand? Pick the channel that works best for you — we typically respond within one business day.
          </p>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {channels.map((channel) => {
            const Icon = channel.icon;
            const externalProps = channel.external
              ? { target: '_blank', rel: 'noopener noreferrer' }
              : {};

            return (
              <Link
                key={channel.title}
                href={channel.href}
                {...externalProps}
                className="group flex flex-col rounded-lg border border-border bg-card p-6 transition-colors hover:border-primary/50 hover:bg-muted/50"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-muted text-foreground">
                  <Icon className="h-5 w-5" />
                </div>
                <h2 className="text-lg font-semibold">{channel.title}</h2>
                <p className="mt-1 flex-1 text-sm text-muted-foreground leading-relaxed">
                  {channel.description}
                </p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
                  {channel.cta}
                  <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </span>
              </Link>
            );
          })}
        </div>

        <div className="mt-8 rounded-lg border border-border bg-muted/40 p-6">
          <h2 className="text-base font-semibold">Enterprise &amp; billing</h2>
          <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
            For enterprise plans, invoicing, or partnership inquiries, email{' '}
            <a href="mailto:support@gatewayz.ai" className="font-medium text-foreground underline underline-offset-4">
              support@gatewayz.ai
            </a>{' '}
            or use the{' '}
            <Link href="/contact" className="font-medium text-foreground underline underline-offset-4">
              contact form
            </Link>{' '}
            and select the relevant topic.
          </p>
        </div>
      </div>
    </div>
  );
}
