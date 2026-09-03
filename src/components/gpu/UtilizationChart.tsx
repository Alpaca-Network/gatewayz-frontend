"use client";

import { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useGpuUtilization } from '@/lib/hooks/use-gpu-public';
import type { GpuUtilizationGroup, GpuUtilizationWindow } from '@/lib/gpu/public-api';

const WINDOWS: GpuUtilizationWindow[] = ['24h', '7d'];
const GROUPS: GpuUtilizationGroup[] = ['region', 'model'];
const LINE_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#0ea5e9', '#a855f7'];

/** Pivots the flat {hour, key, requests}[] series into one row per hour with a
 *  column per distinct `key` (region or model id, per the `group` query param), so
 *  recharts can draw one <Line> per key. */
function pivotByHour(
  series: Array<{ hour: string; key: string; requests: number }>
): { rows: Array<Record<string, string | number>>; groupKeys: string[] } {
  const groupKeys = Array.from(new Set(series.map((point) => point.key))).sort();
  const byHour = new Map<string, Record<string, string | number>>();

  for (const point of series) {
    const row = byHour.get(point.hour) ?? { hour: point.hour };
    row[point.key] = point.requests;
    byHour.set(point.hour, row);
  }

  const rows = Array.from(byHour.values()).sort((a, b) => String(a.hour).localeCompare(String(b.hour)));
  return { rows, groupKeys };
}

export function UtilizationChart() {
  const [window, setWindow] = useState<GpuUtilizationWindow>('24h');
  const [group, setGroup] = useState<GpuUtilizationGroup>('region');
  const query = useGpuUtilization(window, group);

  const { rows, groupKeys } = useMemo(() => pivotByHour(query.data?.series ?? []), [query.data]);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>Utilization</CardTitle>
        <div className="flex flex-wrap gap-2">
          <div className="flex gap-1" role="group" aria-label="Time window">
            {WINDOWS.map((w) => (
              <Button
                key={w}
                size="sm"
                variant={w === window ? 'default' : 'outline'}
                aria-pressed={w === window}
                onClick={() => setWindow(w)}
              >
                {w}
              </Button>
            ))}
          </div>
          <div className="flex gap-1" role="group" aria-label="Group by">
            {GROUPS.map((g) => (
              <Button
                key={g}
                size="sm"
                variant={g === group ? 'default' : 'outline'}
                aria-pressed={g === group}
                onClick={() => setGroup(g)}
              >
                {g}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No utilization data yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              {groupKeys.map((key, i) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  name={key}
                  stroke={LINE_COLORS[i % LINE_COLORS.length]}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
