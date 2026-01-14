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
import { TwitterPixel } from '@/components/analytics/twitter-pixel';
import { SessionInitializer } from '@/components/SessionInitializer';
import { PreviewHostnameRestorer } from '@/components/auth/preview-hostname-restorer';
import { GTMLoader } from '@/components/analytics/gtm-loader';
import { ErrorSuppressor } from '@/components/error-suppressor';
import { AnalyticsProvidersWrapper } from '@/components/providers/analytics-providers-wrapper';
import { ReferralBonusDialog } from '@/components/dialogs/referral-bonus-dialog';
import { SafeStorageShim } from '@/components/safe-storage-shim';
import { ReferralToast } from '@/components/referral/referral-toast';
import { WebVitalsReporter } from '@/components/web-vitals';
import { EarlyErrorSuppressor } from '@/components/early-error-suppressor';
import { FloatingNewChatButton } from '@/components/chat-v2/FloatingNewChatButton';
import { DesktopProvider } from '@/components/providers/desktop-provider';

// Re-export metadata and viewport from dedicated file for cleaner organization
export { metadata, viewport } from './metadata';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  preload: true,
  fallback: ['system-ui', 'arial'],
  adjustFontFallback: true,
});

import { ReactQueryProvider } from "@/lib/providers/query-provider";

// ... (other imports)

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="scroll-smooth">
      <head>
        {/* Early error suppressor must run before wallet extensions inject ethereum */}
        <EarlyErrorSuppressor />
      </head>
        <body className={`${inter.className} antialiased bg-background min-h-screen flex flex-col`} suppressHydrationWarning>
          <SafeStorageShim />
        <ErrorSuppressor />
        {/* ... (script) */}
        <GoogleAnalytics />
        <TwitterPixel />
        <ThemeProvider
          defaultTheme="system"
          storageKey="ui-theme"
        >
          <ReactQueryProvider>
            {/* Preview hostname restoration - handles Vercel preview OAuth redirects */}
            <PreviewHostnameRestorer />
            <PrivyProviderWrapper>
              <AnalyticsProvidersWrapper>
                <DesktopProvider>
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
                <ReferralToast />
                <FloatingNewChatButton />
                <Analytics />
                <SpeedInsights />
                <WebVitalsReporter />
                </DesktopProvider>
              </AnalyticsProvidersWrapper>
            </PrivyProviderWrapper>
          </ReactQueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
