import type {Metadata, Viewport} from 'next';
import Script from 'next/script';
import './globals.css';
import 'katex/dist/katex.min.css';
import { Toaster } from "@/components/ui/toaster";
import { AppHeader } from '@/components/layout/app-header';
import { AppFooter } from '@/components/layout/app-footer';
import { ThemeProvider } from '@/components/theme-provider';
import { PrivyProviderWrapper } from '@/components/providers/privy-provider';
import { OnboardingBanner } from '@/components/onboarding/onboarding-banner';
import { WelcomeDialog } from '@/components/dialogs/welcome-dialog';
import { TrialCreditsNotice } from '@/components/dialogs/trial-credits-notice';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Inter } from 'next/font/google';
import { GoogleAnalytics } from '@/components/analytics/google-analytics';
import { SessionInitializer } from '@/components/SessionInitializer';
import { PreviewHostnameRestorer } from '@/components/auth/preview-hostname-restorer';
import { GTMLoader } from '@/components/analytics/gtm-loader';
import { ErrorSuppressor } from '@/components/error-suppressor';
import { AnalyticsProvidersWrapper } from '@/components/providers/analytics-providers-wrapper';
import { ReferralBonusDialog } from '@/components/dialogs/referral-bonus-dialog';
import { SafeStorageShim } from '@/components/safe-storage-shim';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  preload: true,
  fallback: ['system-ui', 'arial'],
  adjustFontFallback: true,
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: 'Gatewayz - One Interface To Work With Any LLM',
  description: 'From Idea To Production, Gatewayz Gives AI Teams The Toolkit, Savings, And Reliability They Need.',
  keywords: ['AI', 'LLM', 'GPT', 'Claude', 'Gemini', 'API Gateway', 'AI Router', 'Model Routing'],
  authors: [{ name: 'Gatewayz' }],
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  metadataBase: new URL('https://beta.gatewayz.ai'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://beta.gatewayz.ai',
    siteName: 'Gatewayz',
    title: 'Gatewayz - One Interface To Work With Any LLM',
    description: 'From Idea To Production, Gatewayz Gives AI Teams The Toolkit, Savings, And Reliability They Need.',
  },
};

import { ReactQueryProvider } from "@/lib/providers/query-provider";

// ... (other imports)

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="scroll-smooth">
      {/* ... (head content) */}
        <body className={`${inter.className} antialiased bg-background min-h-screen flex flex-col`} suppressHydrationWarning>
          <SafeStorageShim />
        <ErrorSuppressor />
        {/* ... (script) */}
        <GoogleAnalytics />
        <ThemeProvider
          defaultTheme="system"
          storageKey="ui-theme"
        >
          <ReactQueryProvider>
            {/* Preview hostname restoration - handles Vercel preview OAuth redirects */}
            <PreviewHostnameRestorer />
            <PrivyProviderWrapper>
              <AnalyticsProvidersWrapper>
                {/* Session transfer from main domain - handles automatic authentication */}
                <SessionInitializer />
                <GTMLoader />
                <AppHeader />
                <OnboardingBanner />
                <div data-header-spacer aria-hidden="true" className="flex-shrink-0 h-[65px] has-onboarding-banner:h-[115px]" style={{ transition: 'height 0.3s ease' }} />
                <main className="flex-1 flex flex-col w-full overflow-x-hidden">
                  {children}
                </main>
                {/* Keak-script disabled for performance optimization - unclear purpose and no documentation */}
                {/* Enable if needed for analytics: re-enable this script and its source */}
                {/* <Script
                  id="keak-script"
                  src="https://zzontar2hsjaawcn.public.blob.vercel-storage.com/scripts/domain-542-httpsgatewayz.ai.js"
                  data-domain="542"
                  strategy="afterInteractive"
                /> */}
                <Toaster />
                <AppFooter />
                <WelcomeDialog />
                <TrialCreditsNotice />
                <ReferralBonusDialog />
                <Analytics />
                <SpeedInsights />
              </AnalyticsProvidersWrapper>
            </PrivyProviderWrapper>
          </ReactQueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
