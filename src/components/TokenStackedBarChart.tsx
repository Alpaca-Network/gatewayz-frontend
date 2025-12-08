'use client';

import { useState, useEffect, useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ModelData } from '@/app/rankings/page';

interface TokenStackedBarChartProps {
  rankingData?: ModelData[];
}

const TokenStackedBarChart = ({ rankingData }: TokenStackedBarChartProps) => {
  // Start with false, will update on client mount to prevent hydration mismatch
  // This ensures SSR and initial client render match
  const [isMobile, setIsMobile] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // Mark as client-side mounted
    setIsClient(true);

    // Only check window width on client-side
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Helper function to parse token values from strings like "4.8T tokens", "2.35T tokens", etc.
  const parseTokenValue = (tokenStr: string): number => {
    const num = parseFloat(tokenStr.replace(/[^\d.]/g, ''));
    if (tokenStr.includes('T')) return num * 1000; // Convert to billions for chart
    if (tokenStr.includes('B')) return num;
    if (tokenStr.includes('M')) return num / 1000;
    return num;
  };

  // Color palette for bars
  const colors = ['#1e40af', '#ea580c', '#3b82f6', '#eab308', '#2563eb', '#10b981', '#8b5cf6', '#14b8a6', '#4f46e5', '#f97316'];

  // Transform data for Recharts
  const chartData = useMemo(() => {
    if (!rankingData || rankingData.length === 0) return [];

    return rankingData.slice(0, 10).map((model, index) => ({
      name: isMobile
        ? model.model_name.split(' ')[0].substring(0, 8)
        : model.model_name.split(' ').slice(0, 2).join(' '),
      tokens: parseTokenValue(model.tokens),
      color: colors[index] || '#6b7280',
    }));
  }, [rankingData, isMobile]);

  const yAxisFormatter = (value: number) => {
    if (value >= 1000) return `${(value / 1000).toFixed(1)}T`;
    if (value >= 1) return `${value.toFixed(0)}B`;
    return `${(value * 1000).toFixed(0)}M`;
  };

  const tooltipFormatter = (value: number) => {
    if (value >= 1000) return `${(value / 1000).toFixed(1)}T tokens`;
    if (value >= 1) return `${value.toFixed(1)}B tokens`;
    return `${(value * 1000).toFixed(0)}M tokens`;
  };

  return (
    <div className="w-full h-[24rem]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 10, right: 10, bottom: isMobile ? 50 : 10, left: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: isMobile ? 8 : 9 }}
            angle={isMobile ? 45 : 0}
            textAnchor={isMobile ? 'start' : 'middle'}
            height={isMobile ? 60 : 30}
          />
          <YAxis
            tickFormatter={yAxisFormatter}
            tick={{ fontSize: 10 }}
            label={{ value: 'Tokens (Billions)', angle: -90, position: 'insideLeft', offset: -5 }}
          />
          <Tooltip
            formatter={(value: number) => tooltipFormatter(value)}
            contentStyle={{
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '8px',
            }}
          />
          <Bar dataKey="tokens" radius={[8, 8, 0, 0]}>
            {chartData.map((entry, index) => (
              // eslint-disable-next-line react/no-array-index-key
              <Cell key={index} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default TokenStackedBarChart;
