
"use client";

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { addDays, format } from "date-fns";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Download, Filter, Info, Maximize, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";
import { makeAuthenticatedRequest, getApiKey } from '@/lib/api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.gatewayz.ai';

interface ActivityLogEntry {
  id: number;
  timestamp: string;
  provider: string;
  model: string;
  app?: string;
  tokens: number;
  cost: number;
  speed?: number;
  finish_reason?: string;
}

interface ActivityStats {
  total_spend: number;
  total_tokens: number;
  total_requests: number;
  daily_stats: {
    date: string;
    spend: number;
    tokens: number;
    requests: number;
  }[];
}

const ActivityChart = ({ dataKey, title, value, currency = false, data }: { dataKey: "spend" | "tokens" | "requests", title: string, value: string, currency?: boolean, data: any[] }) => {
  // Ensure we have at least 3 data points for a better visual chart
  const chartData = data.length > 0 ? data : [];

  // If only 1 data point, add padding points before and after for visual context
  let displayData = chartData;
  if (chartData.length === 1) {
    const singlePoint = chartData[0];
    const date = new Date(singlePoint.date);
    displayData = [
      {
        date: addDays(date, -1).toISOString().slice(0, 10),
        [dataKey]: 0,
      },
      singlePoint,
      {
        date: addDays(date, 1).toISOString().slice(0, 10),
        [dataKey]: 0,
      },
    ];
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Maximize className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{currency && '$'}{value}</div>
        <div className="h-[120px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={displayData} margin={{ top: 5, right: 10, left: -30, bottom: 0 }}>
              <defs>
                <linearGradient id={`color${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
              <XAxis dataKey="date" hide />
              <YAxis hide domain={[0, 'dataMax + 10']} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  borderColor: 'hsl(var(--border))',
                }}
                labelFormatter={(label) => format(new Date(label), "PPP")}
                formatter={(value: any) => [
                  currency ? `$${Number(value).toFixed(2)}` : Number(value).toLocaleString(),
                  title
                ]}
              />
              <Area
                type="monotone"
                dataKey={dataKey}
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fillOpacity={1}
                fill={`url(#color${dataKey})`}
                dot={chartData.length <= 3 ? { fill: 'hsl(var(--primary))', r: 4 } : false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default function ActivityPage() {
  const [mounted, setMounted] = useState(false);
  const [date, setDate] = useState<DateRange | undefined>({
    from: addDays(new Date(), -29),
    to: new Date(),
  });
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalSpend, setTotalSpend] = useState('0.00');
  const [totalTokens, setTotalTokens] = useState('0');
  const [totalRequests, setTotalRequests] = useState('0');
  const [currentPage, setCurrentPage] = useState(1);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchActivityData = async () => {
    try {
      setLoading(true);

      // Check if user is authenticated before fetching
      const apiKey = getApiKey();
      if (!apiKey) {
        console.log('Waiting for authentication to complete...');
        setLoading(false);
        return;
      }

      const fromDate = date?.from ? format(date.from, 'yyyy-MM-dd') : format(addDays(new Date(), -29), 'yyyy-MM-dd');
      const toDate = date?.to ? format(date.to, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');

      // Fetch activity stats for charts
      const statsResponse = await makeAuthenticatedRequest(
        `/api/user/activity/stats?from=${fromDate}&to=${toDate}`
      );

      if (statsResponse.ok) {
        const stats: ActivityStats = await statsResponse.json();
        setTotalSpend(stats.total_spend.toFixed(2));
        setTotalTokens(stats.total_tokens.toLocaleString());
        setTotalRequests(stats.total_requests.toLocaleString());
        setChartData(stats.daily_stats || []);
      }

      // Fetch activity log
      const logResponse = await makeAuthenticatedRequest(
        `/api/user/activity/log?from=${fromDate}&to=${toDate}&page=${currentPage}&limit=10`
      );

      if (logResponse.ok) {
        const logData = await logResponse.json();
        setActivityLog(logData.logs || []);
      }
    } catch (error) {
      console.log('Failed to fetch activity data:', error);
      // Use fallback data on error
      const fallbackChartData = Array.from({ length: 30 }, (_, i) => ({
        date: addDays(new Date(), -29 + i).toISOString().slice(0, 10),
        spend: 0,
        tokens: 0,
        requests: 0,
      }));
      setChartData(fallbackChartData);
      setActivityLog([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (mounted) {
      fetchActivityData();
    }
  }, [date, currentPage, mounted]);

  if (!mounted) {
    return (
      <div className="space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Your Activity</h1>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
            <h1 className="text-3xl font-bold">Your Activity</h1>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground"
              onClick={fetchActivityData}
              disabled={loading}
            >
                <RefreshCw className={cn("h-5 w-5", loading && "animate-spin")} />
            </Button>
        </div>
        <p className="text-muted-foreground">
          See how you&apos;ve been using models on Gatewayz
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <ActivityChart dataKey="spend" title="Spend" value={totalSpend} currency data={chartData} />
        <ActivityChart dataKey="tokens" title="Tokens" value={totalTokens} data={chartData} />
        <ActivityChart dataKey="requests" title="Requests" value={totalRequests} data={chartData} />
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm">From:</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="date"
                variant={"outline"}
                className={cn("w-[240px] justify-start text-left font-normal", !date && "text-muted-foreground")}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date?.from ? format(date.from, "LLL dd, y") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={date?.from}
                selected={date}
                onSelect={setDate}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
          <span className="text-sm">To:</span>
           <Popover>
            <PopoverTrigger asChild>
              <Button
                id="date-to"
                variant={"outline"}
                className={cn("w-[240px] justify-start text-left font-normal", !date?.to && "text-muted-foreground")}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date?.to ? format(date.to, "LLL dd, y") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
               <Calendar
                initialFocus
                mode="range"
                defaultMonth={date?.from}
                selected={date}
                onSelect={setDate}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline"><Filter className="mr-2 h-4 w-4" />Filters</Button>
          <Button variant="outline"><Download className="mr-2 h-4 w-4" />Export</Button>
        </div>
      </div>
      
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Provider / Model</TableHead>
                <TableHead>App</TableHead>
                <TableHead className="text-right">Tokens</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">Speed (T/s)</TableHead>
                <TableHead className="text-right">Finish Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                    <p className="text-muted-foreground">Loading activity...</p>
                  </TableCell>
                </TableRow>
              ) : activityLog.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <p className="text-muted-foreground">No activity found for the selected date range.</p>
                  </TableCell>
                </TableRow>
              ) : (
                activityLog.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>{new Date(log.timestamp).toLocaleString()}</TableCell>
                    <TableCell>{log.provider} / {log.model}</TableCell>
                    <TableCell>{log.app || 'API'}</TableCell>
                    <TableCell className="text-right">{log.tokens.toLocaleString()}</TableCell>
                    <TableCell className="text-right">${log.cost.toFixed(5)}</TableCell>
                    <TableCell className="text-right">{log.speed ? log.speed.toFixed(2) : '-'}</TableCell>
                    <TableCell className="text-right">{log.finish_reason || 'stop'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex justify-center items-center gap-2 mt-4">
        <Button
          variant="outline"
          size="icon"
          disabled={currentPage === 1 || loading}
          onClick={() => setCurrentPage(p => p - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon">{currentPage}</Button>
        <Button
          variant="outline"
          size="icon"
          disabled={activityLog.length < 10 || loading}
          onClick={() => setCurrentPage(p => p + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
