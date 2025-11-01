import { TrendingDown, Zap, Users, BarChart } from "lucide-react";

export default function Statistics() {
  const stats = [
    {
      icon: TrendingDown,
      value: "60%",
      label: "Average Cost Reduction",
      description: "Save on AI inference costs with smart routing"
    },
    {
      icon: Zap,
      value: "<100ms",
      label: "Routing Latency",
      description: "Lightning-fast model selection and response"
    },
    {
      icon: Users,
      value: "10,000+",
      label: "AI Models Available",
      description: "Access every major model through one API"
    },
    {
      icon: BarChart,
      value: "85%",
      label: "Developers Overpay",
      description: "Don't be one of them—optimize with Gatewayz"
    }
  ];

  return (
    <section className="py-16 md:py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-indigo-50/30 to-white">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            The Numbers Speak for Themselves
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Real data points from developers using Gatewayz to optimize their AI infrastructure
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat) => (
            <div 
              key={stat.label}
              className="bg-white rounded-2xl p-6 border border-gray-200 hover:border-indigo-300 shadow-sm hover:shadow-xl transition-all duration-300 text-center group"
            >
              <div className="w-12 h-12 mx-auto rounded-xl bg-gradient-to-br from-indigo-50 to-indigo-100 flex items-center justify-center mb-4 group-hover:from-indigo-100 group-hover:to-indigo-200 transition-all">
                <stat.icon className="w-6 h-6 text-indigo-600" />
              </div>
              <div className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent mb-2">
                {stat.value}
              </div>
              <div className="text-sm font-semibold text-gray-900 mb-2">
                {stat.label}
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">
                {stat.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
