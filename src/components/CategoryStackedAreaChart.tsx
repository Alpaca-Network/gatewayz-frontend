"use client";

import { useMemo, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { format, subDays, startOfDay } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ModelData } from '@/app/rankings/page';

interface CategoryStackedAreaChartProps {
  rankingData: ModelData[];
}

// Generate time series data with percentage-based stacked values
const generateTimeSeriesData = (models: ModelData[], days: number) => {
  const endDate = startOfDay(new Date());
  const dataPoints: any[] = [];

  // Get top 10 models by token count
  const topModels = models
    .slice(0, 10)
    .map(model => ({
      name: model.model_name,
      author: model.author,
      baseValue: Math.random() * 100 + 50, // Random base for variation
    }));

  // Create "Others" category
  const othersData = {
    name: 'Others',
    author: '--',
    baseValue: Math.random() * 50 + 20,
  };

  // Generate data for each day
  for (let i = days - 1; i >= 0; i--) {
    const date = subDays(endDate, i);
    const dateStr = format(date, 'MMM d');

    const dataPoint: any = {
      date: dateStr,
      fullDate: format(date, 'yyyy-MM-dd'),
    };

    // Add some randomness to simulate real usage patterns
    let total = 0;
    topModels.forEach(model => {
      const randomVariation = (Math.random() - 0.5) * 20;
      const value = Math.max(10, model.baseValue + randomVariation + (Math.random() * i * 0.5));
      dataPoint[model.name] = Math.round(value);
      total += value;
    });

    // Add others
    const othersValue = Math.max(10, othersData.baseValue + (Math.random() - 0.5) * 15);
    dataPoint[othersData.name] = Math.round(othersValue);
    total += othersValue;

    // Convert to percentages
    Object.keys(dataPoint).forEach(key => {
      if (key !== 'date' && key !== 'fullDate') {
        dataPoint[key] = ((dataPoint[key] / total) * 100).toFixed(1);
      }
    });

    dataPoints.push(dataPoint);
  }

  return { dataPoints, categories: [...topModels, othersData] };
};

// Color palette for the chart
const COLORS = [
  '#3b82f6', // blue
  '#eab308', // yellow/gold
  '#f97316', // orange
  '#10b981', // green
  '#06b6d4', // cyan
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#14b8a6', // teal
  '#84cc16', // lime
  '#f43f5e', // red
  '#ec4899', // magenta for others
];

const CategoryStackedAreaChart = ({ rankingData }: CategoryStackedAreaChartProps) => {
  const [timeRange, setTimeRange] = useState<'week' | 'month' | '3months'>('3months');

  const days = timeRange === 'week' ? 7 : timeRange === 'month' ? 30 : 90;

  const { chartData, categories } = useMemo(() => {
    const { dataPoints, categories } = generateTimeSeriesData(rankingData, days);
    return { chartData: dataPoints, categories };
  }, [rankingData, days]);

  // Calculate custom X-axis ticks
  const xAxisTicks = useMemo(() => {
    const tickCount = timeRange === 'week' ? 7 : timeRange === 'month' ? 6 : 8;
    const interval = Math.floor(chartData.length / tickCount);
    const ticks: string[] = [];

    for (let i = 0; i < chartData.length; i += interval) {
      ticks.push(chartData[i].date);
    }

    // Always include the last data point
    if (ticks[ticks.length - 1] !== chartData[chartData.length - 1].date) {
      ticks.push(chartData[chartData.length - 1].date);
    }

    return ticks;
  }, [chartData, timeRange]);

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-lg font-semibold">Categories</h3>
          <p className="text-sm text-muted-foreground">
            Compare models by usecase
          </p>
        </div>
        <Select value={timeRange} onValueChange={(value: any) => setTimeRange(value)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">Last Week</SelectItem>
            <SelectItem value="month">Last Month</SelectItem>
            <SelectItem value="3months">Last 3 Months</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="h-[400px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            stackOffset="expand"
          >
            <defs>
              {categories.map((category, index) => (
                <linearGradient
                  key={category.name}
                  id={`color${index}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="5%" stopColor={COLORS[index]} stopOpacity={0.8} />
                  <stop offset="95%" stopColor={COLORS[index]} stopOpacity={0.3} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="date"
              ticks={xAxisTicks}
              tick={{ fontSize: 12 }}
              stroke="#6b7280"
            />
            <YAxis
              tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
              tick={{ fontSize: 12 }}
              stroke="#6b7280"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                padding: '12px',
              }}
              formatter={(value: any, name: string) => [`${parseFloat(value).toFixed(1)}%`, name]}
              labelStyle={{ fontWeight: 'bold', marginBottom: '8px' }}
            />
            {categories.map((category, index) => (
              <Area
                key={category.name}
                type="monotone"
                dataKey={category.name}
                stackId="1"
                stroke={COLORS[index]}
                fill={`url(#color${index})`}
                strokeWidth={0}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {categories.map((category, index) => (
          <div key={category.name} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: COLORS[index] }}
            />
            <div className="min-w-0">
              <p className="text-xs font-medium truncate">{category.name}</p>
              <p className="text-xs text-muted-foreground">
                by {category.author}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CategoryStackedAreaChart;
