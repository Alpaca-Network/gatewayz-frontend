import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Trust Center | Gatewayz',
  description: 'Gatewayz Trust Center - Security, compliance, and certifications',
};

export default function TrustPage() {
  return (
    <div className="min-h-screen bg-background">
      <iframe
        src="https://trust.trycybe.ai/gatewayz"
        title="Gatewayz Trust Center"
        className="w-full h-screen border-0"
        allowFullScreen
      />
    </div>
  );
}
