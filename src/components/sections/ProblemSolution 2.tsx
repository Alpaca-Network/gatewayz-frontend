import { AlertCircle, CheckCircle } from "lucide-react";

export default function ProblemSolution() {
  return (
    <section id="solution" className="py-16 md:py-20 px-4 sm:px-6 lg:px-8 scroll-mt-16 bg-slate-50">
      <div className="container mx-auto max-w-5xl">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">The AI Inference Challenge</h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">Managing AI inference costs and latency shouldn't be this complicated</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Problem */}
          <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-lg hover:shadow-xl transition-shadow duration-300">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mt-1">The Problem</h3>
            </div>
            <p className="text-gray-600 text-base mb-5 leading-relaxed">
              Managing multiple AI providers means dealing with fragmented APIs, scattered billing, and unpredictable costs.
            </p>
            <ul className="space-y-3">
              {["Different APIs for each provider", "Multiple dashboards & invoices", "No cost optimization"].map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-gray-600">
                  <span className="w-2 h-2 rounded-full bg-red-400 mt-1.5 flex-shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Solution */}
          <div className="bg-gradient-to-br from-indigo-50 via-indigo-50/50 to-white rounded-2xl p-8 border border-indigo-300 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-100 to-indigo-200 flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-6 h-6 text-indigo-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mt-1">The Solution</h3>
            </div>
            <p className="text-gray-700 text-base mb-5 leading-relaxed">
              <strong className="text-indigo-600 font-semibold">Gatewayz</strong> unifies 10,000+ models into one API—smart routing, transparent pricing, single invoice.
            </p>
            <ul className="space-y-3">
              {["One API for all providers", "Single bill, simplified tracking", "Auto-optimized for cost & speed"].map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-gray-700">
                  <CheckCircle className="w-5 h-5 text-indigo-600 mt-0.5 flex-shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
