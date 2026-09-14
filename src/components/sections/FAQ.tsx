import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default function FAQ() {
  // Every answer describes what the API does today. No model counts, SLAs,
  // latency or cost-reduction figures: a number we cannot source is removed,
  // never restated.
  const faqs = [
    {
      question: "What is Gatewayz?",
      answer: "Gatewayz is the inference layer for the agentic economy: one key and one neutral endpoint for every agent you run. It is OpenAI-compatible, with native Anthropic Messages at /v1/messages."
    },
    {
      question: "What is an AI inference gateway?",
      answer: "A single API between your software and the model providers. You integrate once, with one key, and the gateway handles authentication, request translation and billing for each provider behind it."
    },
    {
      question: "Which AI models does Gatewayz support?",
      answer: "Models from five providers: OpenAI, Anthropic, xAI, Moonshot and Meta. We do not currently serve Google Gemini, Mistral, Llama, DeepSeek or Qwen. The live list, with per-model prices, is in the model catalog and at GET https://api.gatewayz.ai/v1/models."
    },
    {
      question: "What does \"neutral\" mean?",
      answer: "We have no model of our own, so nothing is steered toward one. Resolution, never substitution: the model id you send is the model you get, and an unknown id returns a 400 with model_not_found rather than a swap to the nearest model."
    },
    {
      question: "How does Gatewayz report errors?",
      answer: "With status codes and error codes software can act on. An unknown model returns 400 model_not_found. A key that has spent its cap returns 402 request_cap_exhausted. An account with no credits returns 402 insufficient_credits. A stream that fails upstream ends with an explicit error event, so a truncated response is never mistaken for a complete one."
    },
    {
      question: "How much does Gatewayz cost?",
      answer: "Pay-as-you-go, with no subscription requirement. Prices are cost-plus — a markup over what the provider charges — and published per model in the catalog, not as a blanket discount. Your first top-up of $5 or more earns $5 in bonus credits."
    },
    {
      question: "Is Gatewayz compatible with the OpenAI SDK?",
      answer: "Yes. Set the base URL to https://api.gatewayz.ai/v1 and use your Gatewayz API key; the rest of your OpenAI client code stays the same. For Claude Code and Anthropic SDKs, set ANTHROPIC_BASE_URL=https://api.gatewayz.ai."
    },
    {
      question: "Does Gatewayz store my prompts?",
      answer: "Plain API calls store no prompt or completion content."
    },
    {
      question: "How does Gatewayz compare to OpenRouter?",
      answer: "Both give you one key for many models. OpenRouter has the larger catalog and the longer track record. Gatewayz is narrower on purpose: native Anthropic Messages, exact model resolution, and errors your code can branch on. Our comparison page at /compare/gatewayz-vs-openrouter lays out where each one wins."
    },
    {
      question: "How do I get started with Gatewayz?",
      answer: "Sign up, add credits and create an API key. Then point any OpenAI client at https://api.gatewayz.ai/v1, or set ANTHROPIC_BASE_URL=https://api.gatewayz.ai for Claude Code."
    },
    {
      question: "Is Gatewayz suitable for production use?",
      answer: "Gatewayz is a newer service run by a small team, and we do not offer an uptime SLA. What we do offer is behaviour you can build on: exact model resolution, stable error codes, and streams that end with an explicit error event when an upstream fails. Weigh that honestly if it sits on a critical path today."
    },
    {
      question: "What kind of support does Gatewayz provide?",
      answer: "Email the team or join the community on Discord — the support page has both, along with the documentation and per-agent setup guides."
    }
  ];

  return (
    <section id="faq" className="py-12 md:py-16 scroll-mt-16 bg-gradient-to-b from-background to-muted/30">
      <div className="container max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl md:text-4xl font-bold mb-3 text-foreground">
            Frequently Asked Questions
          </h2>
          <p className="text-base text-muted-foreground">
            Everything you need to know about Gatewayz
          </p>
        </div>

        <Accordion type="single" collapsible className="w-full space-y-4">
          {faqs.map((faq, index) => (
            <AccordionItem
              key={index}
              value={`item-${index}`}
              className="bg-card rounded-lg border border-border px-6"
            >
              <AccordionTrigger className="text-left hover:no-underline py-5">
                <span className="font-semibold text-foreground">{faq.question}</span>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground pb-5">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <div className="mt-6 pt-6 border-t border-border text-center">
          <p className="text-sm text-muted-foreground mb-2">
            Still have questions?{" "}
            <a
              href="/contact"
              className="text-primary hover:text-primary/80 font-semibold"
            >
              Contact our team →
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}