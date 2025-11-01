import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default function FAQ() {
  const faqs = [
    {
      question: "What is an AI inference gateway?",
      answer: "An AI inference gateway is a unified API layer that routes requests to multiple AI model providers. Instead of integrating with dozens of different APIs, you connect to one gateway that handles routing, load balancing, and failover across all providers. Gatewayz acts as this universal gateway for 10,000+ AI models."
    },
    {
      question: "How does Gatewayz reduce latency and cost?",
      answer: "Gatewayz reduces latency through smart geographic routing to the nearest available model endpoint, reducing round-trip time by up to 70%. We reduce costs by automatically selecting the most cost-efficient model that meets your quality requirements, pooling quotas across providers to avoid premium pricing tiers, and eliminating the need for multiple API subscriptions."
    },
    {
      question: "How can developers monetize inference usage?",
      answer: "Developers can earn revenue through our Build-to-Earn program. When you build integrations, custom routing logic, or specialized endpoints on Gatewayz, you earn a share of the inference revenue generated through your builds. It's a decentralized approach to AI infrastructure where contributors are rewarded."
    },
    {
      question: "What is Gatewayz?",
      answer: "Gatewayz is a universal AI inference API that provides unified access to 10,000+ AI models including GPT-4, Claude, Gemini, and more through a single API endpoint. We offer smart routing, transparent pricing, and the lowest latency for AI inference."
    },
    {
      question: "How does Gatewayz compare to OpenRouter?",
      answer: "Gatewayz offers similar unified API access to multiple AI models but with enhanced features including smart routing, quota pooling, unified billing, and optimized latency. We provide comprehensive monitoring to ensure reliable AI inference at scale."
    },
    {
      question: "Which AI models does Gatewayz support?",
      answer: "Gatewayz supports 10,000+ AI models including OpenAI's GPT-4, Anthropic's Claude, Google's Gemini, Meta's LLaMA, Mistral AI, and many more. We continuously add new models to ensure you have access to the latest AI capabilities."
    },
    {
      question: "How much does Gatewayz cost?",
      answer: "Gatewayz is currently in closed beta with free access and bonus credits for early users. We offer transparent, pay-as-you-go pricing with unified billing across all models. No hidden fees or subscription requirements during beta."
    },
    {
      question: "Is Gatewayz compatible with OpenAI SDK?",
      answer: "Yes! Gatewayz is fully compatible with the OpenAI SDK. Simply change the base URL to https://api.gatewayz.ai/v1 and use your Gatewayz API key. Your existing code works without any modifications."
    },
    {
      question: "What are the benefits of using Gatewayz API?",
      answer: "Gatewayz provides unified access to multiple AI models, smart routing for optimal performance, quota pooling to prevent rate limits, unified billing for simplified cost management, and the lowest latency through our optimized infrastructure. Perfect for developers, SaaS teams, and AI agent platforms."
    },
    {
      question: "How do I get started with Gatewayz?",
      answer: "Join our closed beta by signing up on our website. You'll receive free credits and immediate API access. Integration takes less than 5 minutes with our OpenAI-compatible API and comprehensive documentation."
    },
    {
      question: "Is Gatewayz suitable for production use?",
      answer: "Absolutely. While we're in closed beta, Gatewayz is built on enterprise-grade infrastructure with 99.9% uptime, comprehensive monitoring, and scalable architecture. Thousands of developers already rely on Gatewayz for their production AI workloads."
    },
    {
      question: "What kind of support does Gatewayz provide?",
      answer: "During the closed beta, all users receive priority support including dedicated onboarding, technical documentation, code examples, and direct access to our engineering team for integration assistance."
    }
  ];

  return (
    <section id="faq" className="py-12 md:py-16 scroll-mt-16 bg-gradient-to-b from-white to-indigo-50/30">
      <div className="container max-w-4xl">
        <div className="text-center mb-8">
          <h2 className="text-3xl md:text-4xl font-bold mb-3 text-gray-900">
            Frequently Asked Questions
          </h2>
          <p className="text-base text-gray-600">
            Everything you need to know about Gatewayz AI API
          </p>
        </div>

        <Accordion type="single" collapsible className="w-full space-y-4">
          {faqs.map((faq, index) => (
            <AccordionItem 
              key={index} 
              value={`item-${index}`}
              className="bg-white rounded-lg border border-gray-200 px-6"
            >
              <AccordionTrigger className="text-left hover:no-underline py-5">
                <span className="font-semibold text-gray-900">{faq.question}</span>
              </AccordionTrigger>
              <AccordionContent className="text-gray-600 pb-5">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <div className="mt-6 pt-6 border-t border-gray-200 text-center">
          <p className="text-sm text-gray-600 mb-2">
            Still have questions?{" "}
            <a 
              href="/contact" 
              className="text-indigo-600 hover:text-indigo-700 font-semibold"
            >
              Contact our team →
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}