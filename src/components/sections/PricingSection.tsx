import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { trackTwitterSignupClick } from "@/components/analytics/twitter-pixel";

const tiers = [
  {
    name: "Starter",
    price: "$35",
    period: "/month",
    subtitle: "Perfect for getting started",
    description: "Essential features for small teams",
    features: [
      "Access to 10,000+ models",
      "Smart cost optimization",
      "Community support",
      "Basic analytics",
    ],
    cta: "Get Started",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$120",
    period: "/month",
    subtitle: "Scale with confidence",
    description: "Advanced features for growing teams",
    features: [
      "Everything in Starter",
      "Access to 10,000+ models",
      "Smart cost optimization",
      "Terragon: Task inbox for AI coding agents",
      "Priority support",
      "99.9% uptime SLA",
    ],
    cta: "Get Started",
    highlighted: false,
  },
  {
    name: "Max",
    price: "$350",
    period: "/month",
    subtitle: "Higher limits, priority access",
    description: "Everything in Pro, plus enhanced limits",
    features: [
      "Everything in Pro",
      "10x more usage than Pro",
      "Higher output limits for all tasks",
      "Early access to advanced features",
    ],
    cta: "Get Started",
    highlighted: true,
  },
  {
    name: "Custom",
    price: "Custom",
    period: "",
    subtitle: "Tailored to your business",
    description: "Custom solutions for your organization",
    features: [
      "Dedicated infrastructure",
      "Custom model training",
      "White-label options",
      "24/7 dedicated support",
      "99.99% uptime SLA",
    ],
    cta: "Book your audit",
    highlighted: false,
  },
];

export function PricingSection() {
  const handleClick = (tierName: string) => {
    if (tierName === "Custom") {
      // Custom tier goes to enterprise page - don't track as signup conversion
      window.location.href = "https://gatewayz.ai/enterprise";
    } else {
      // Track Twitter conversion for ad attribution (signup tiers only)
      trackTwitterSignupClick();
      document.getElementById("waitlist")?.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section id="pricing" className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-slate-50 to-white">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-gray-900">Simple, Transparent Pricing</h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Gatewayz is a universal inference engine providing access to 10,000+ models. One API at the lowest cost. Try now with free credits today.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {tiers.map((tier) => (
            <Card
              key={tier.name}
              className={`p-6 flex flex-col bg-white rounded-xl transition-all duration-300 ${
                tier.highlighted 
                  ? "border-2 border-indigo-500 shadow-xl hover:shadow-2xl hover:-translate-y-1 relative" 
                  : "border border-gray-200 shadow-md hover:shadow-lg hover:-translate-y-1"
              }`}
            >
              {tier.highlighted && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="inline-block px-4 py-1.5 rounded-full bg-indigo-600 text-white text-xs font-semibold shadow-lg">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="mb-4">
                <h3 className="text-xl font-bold mb-1 text-gray-900">{tier.name}</h3>
                <p className="text-xs text-gray-500">{tier.subtitle}</p>
              </div>

              <div className="mb-3">
                <div className="flex items-baseline gap-1.5">
                  <span className={`font-bold text-gray-900 ${tier.price.length > 10 ? "text-2xl" : "text-3xl"}`}>{tier.price}</span>
                  {tier.period && <span className="text-gray-500 text-sm">{tier.period}</span>}
                </div>
              </div>

              <p className="text-sm text-gray-600 mb-4">{tier.description}</p>

              <div className="space-y-2.5 flex-1 mb-5">
                {tier.features.map((feature) => (
                  <div key={feature} className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-600 leading-snug">{feature}</span>
                  </div>
                ))}
              </div>

              <Button 
                className="w-full mt-auto" 
                variant={tier.highlighted ? "default" : "outline"}
                onClick={() => handleClick(tier.name)}
              >
                {tier.cta}
              </Button>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
