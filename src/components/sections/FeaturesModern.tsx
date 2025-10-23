import { Card } from "@/components/ui/card";
import { Zap, Shield, Globe, Code } from "lucide-react";

const features = [
  {
    icon: Zap,
    title: "Smart Routing",
    description: "Automatically selects the fastest and most cost-efficient model for your request",
  },
  {
    icon: Shield,
    title: "Enterprise Security",
    description: "Bank-grade encryption with SOC 2 compliance and dedicated infrastructure",
  },
  {
    icon: Globe,
    title: "Global Scale",
    description: "Worldwide infrastructure with 99.9% uptime SLA and sub-100ms latency",
  },
  {
    icon: Code,
    title: "Developer First",
    description: "Comprehensive SDKs, detailed docs, and responsive support for your team",
  },
];

export function FeaturesModern() {
  return (
    <section id="features" className="py-12 md:py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-white to-slate-50">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-gray-900">Decentralized Infrastructure for AI</h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Everything you need to build and scale AI-powered applications with superior developer experience
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {features.map((feature) => (
            <Card key={feature.title} className="group p-10 bg-white border border-gray-200 hover:shadow-2xl transition-all duration-300 hover:border-indigo-300 hover:-translate-y-1 rounded-2xl">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-50 to-indigo-100 flex items-center justify-center mb-5 group-hover:from-indigo-100 group-hover:to-indigo-200 transition-all duration-300 group-hover:scale-110">
                <feature.icon className="w-7 h-7 text-indigo-600" />
              </div>
              <h3 className="text-2xl font-semibold mb-3 text-gray-900">{feature.title}</h3>
              <p className="text-gray-600 leading-relaxed text-base">{feature.description}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
