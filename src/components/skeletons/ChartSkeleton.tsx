import { Card } from '@/components/ui/card';

export function ChartSkeleton() {
  return (
    <Card className="p-4 w-full">
      <div className="space-y-4">
        <div className="h-6 bg-muted rounded w-1/4 animate-pulse" />
        <div className="h-64 bg-muted rounded animate-pulse" />
      </div>
    </Card>
  );
}
