import Link from "next/link";
import type { Metadata } from "next";

// Served in place of /stake (rewritten by src/middleware.ts) to visitors in a
// restricted country. noindex comes from ../layout.tsx.
export const metadata: Metadata = {
  title: "Not available in your region | Gatewayz",
};

export default function StakeUnavailablePage() {
  return (
    <main className="mx-auto max-w-xl px-5 py-24">
      <h1 className="text-2xl font-bold">Not available in your region</h1>
      <p className="mt-3 text-muted-foreground">
        The Gatewayz yield vault is in development and will not be offered in the
        United States or Canada. The rest of Gatewayz works as usual.
      </p>
      <div className="mt-6 flex gap-4 text-sm">
        <Link href="/chat" className="text-primary underline">
          Open the chat
        </Link>
        <Link href="/stake/terms" className="text-primary underline">
          Status &amp; eligibility
        </Link>
      </div>
    </main>
  );
}
