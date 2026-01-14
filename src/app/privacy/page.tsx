import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy | Gatewayz',
  description: 'Gatewayz Privacy Policy - Learn how we collect, use, and protect your data',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-[calc(100vh-130px)] bg-background pb-32" style={{ marginTop: '-65px' }}>
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8 pt-32">
        <header className="mb-8">
          <h1 className="text-4xl font-bold tracking-tight">Privacy Policy</h1>
          <p className="mt-2 text-muted-foreground">Last updated: January 2026</p>
        </header>

        <div className="prose prose-neutral dark:prose-invert max-w-none">
          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">1. Introduction</h2>
            <p className="text-muted-foreground leading-relaxed">
              Gatewayz (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) is committed to protecting your privacy.
              This Privacy Policy explains how we collect, use, disclose, and safeguard your information
              when you use our AI gateway service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">2. Information We Collect</h2>

            <h3 className="text-xl font-medium mt-4 mb-2">2.1 Account Information</h3>
            <p className="text-muted-foreground leading-relaxed">
              When you create an account, we collect:
            </p>
            <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
              <li>Email address</li>
              <li>Name (optional)</li>
              <li>Authentication credentials</li>
              <li>Payment information (processed by our payment provider)</li>
            </ul>

            <h3 className="text-xl font-medium mt-4 mb-2">2.2 Usage Data</h3>
            <p className="text-muted-foreground leading-relaxed">
              We automatically collect certain information when you use the Service:
            </p>
            <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
              <li>API request logs (timestamps, endpoints, response codes)</li>
              <li>Token usage and model selection</li>
              <li>Device and browser information</li>
              <li>IP address and general location</li>
            </ul>

            <h3 className="text-xl font-medium mt-4 mb-2">2.3 Content Data</h3>
            <p className="text-muted-foreground leading-relaxed">
              We process the prompts and responses you send through our API. We do not use your content
              to train AI models. Content may be temporarily cached to improve performance.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">3. How We Use Your Information</h2>
            <p className="text-muted-foreground leading-relaxed">
              We use the information we collect to:
            </p>
            <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
              <li>Provide and maintain the Service</li>
              <li>Process transactions and send billing information</li>
              <li>Monitor and analyze usage patterns</li>
              <li>Detect and prevent fraud and abuse</li>
              <li>Communicate with you about the Service</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">4. Information Sharing</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may share your information with:
            </p>
            <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
              <li><strong>AI Model Providers:</strong> Your prompts are sent to the AI providers you select</li>
              <li><strong>Service Providers:</strong> Third parties that help us operate the Service</li>
              <li><strong>Legal Requirements:</strong> When required by law or to protect our rights</li>
              <li><strong>Business Transfers:</strong> In connection with a merger or acquisition</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              We do not sell your personal information to third parties.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">5. Data Retention</h2>
            <p className="text-muted-foreground leading-relaxed">
              We retain your information for as long as your account is active or as needed to provide
              the Service. Chat history and API logs are retained according to your account settings.
              You can request deletion of your data at any time.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">6. Data Security</h2>
            <p className="text-muted-foreground leading-relaxed">
              We implement appropriate technical and organizational security measures to protect your
              information, including:
            </p>
            <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
              <li>Encryption in transit and at rest</li>
              <li>Access controls and authentication</li>
              <li>Regular security assessments</li>
              <li>Incident response procedures</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">7. Your Rights</h2>
            <p className="text-muted-foreground leading-relaxed">
              Depending on your location, you may have the right to:
            </p>
            <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
              <li>Access your personal information</li>
              <li>Correct inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Object to certain processing</li>
              <li>Data portability</li>
              <li>Withdraw consent</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              To exercise these rights, contact us at{' '}
              <a href="mailto:privacy@gatewayz.ai" className="text-primary hover:underline">
                privacy@gatewayz.ai
              </a>
              .
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">8. Cookies and Tracking</h2>
            <p className="text-muted-foreground leading-relaxed">
              We use cookies and similar technologies to:
            </p>
            <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
              <li>Maintain your session and preferences</li>
              <li>Analyze usage and improve the Service</li>
              <li>Provide personalized content</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              You can control cookies through your browser settings.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">9. International Transfers</h2>
            <p className="text-muted-foreground leading-relaxed">
              Your information may be transferred to and processed in countries other than your own.
              We ensure appropriate safeguards are in place for such transfers in compliance with
              applicable data protection laws.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">10. Children&apos;s Privacy</h2>
            <p className="text-muted-foreground leading-relaxed">
              The Service is not intended for users under 18 years of age. We do not knowingly collect
              personal information from children.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">11. Changes to This Policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of material changes
              by posting the updated policy on this page and updating the &quot;Last updated&quot; date.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">12. Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have questions about this Privacy Policy or our data practices, please contact us at:
            </p>
            <ul className="list-none text-muted-foreground mt-2 space-y-1">
              <li>
                Email:{' '}
                <a href="mailto:privacy@gatewayz.ai" className="text-primary hover:underline">
                  privacy@gatewayz.ai
                </a>
              </li>
              <li>
                General Inquiries:{' '}
                <a href="mailto:support@gatewayz.ai" className="text-primary hover:underline">
                  support@gatewayz.ai
                </a>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
