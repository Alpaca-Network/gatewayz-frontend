import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * The trust-boundary disclosure from spec.md §1: community nodes are run by
 * external operators who see prompt content by construction. Routing to
 * them is opt-in per request (`community/<model>`), never automatic
 * failover or auto-routing, and only open-weight, admin-approved models are
 * served.
 */
export function TrustDisclosure() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>How this works</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
        <p>
          Community GPU nodes are run by independent operators who serve open-weight models through an
          OpenAI-compatible endpoint. Gatewayz records every request, spot-checks a sample of the work, and pays
          operators in WAYZ from the rewards pool once it&apos;s verified.
        </p>
        <p>
          Because a community node <em>is</em> the compute, it sees prompt content by construction. Routing to a
          community node only ever happens when you explicitly request a <code>community/&lt;model&gt;</code> id —
          it is never chosen by auto-routing or used as a failover for another provider. Only open-weight models
          from admin-approved operators are offered.
        </p>
        <p>
          <a
            href="https://github.com/Alpaca-Network/gatewayz-backend/blob/main/docs/gpu/PROVIDER_ONBOARDING.md"
            target="_blank"
            rel="noreferrer"
            className="text-primary underline"
          >
            Read the full provider onboarding guide
          </a>
        </p>
      </CardContent>
    </Card>
  );
}
