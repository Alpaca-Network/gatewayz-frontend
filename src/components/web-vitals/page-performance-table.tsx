"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Search,
  ExternalLink,
  TrendingUp,
} from "lucide-react";
import type { PageWebVitals, WebVitalRating } from "@/lib/web-vitals-types";
import { formatMetricValue } from "@/lib/web-vitals-types";
import { usePagePerformance } from "@/hooks/use-web-vitals";

interface PagePerformanceTableProps {
  initialData?: PageWebVitals[];
}

export function PagePerformanceTable({ initialData }: PagePerformanceTableProps) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("pageLoads");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const limit = 10;

  const { data, loading, refetch } = usePagePerformance({
    limit,
    offset: page * limit,
    sortBy,
    sortOrder,
    search,
    pollingInterval: 0, // Disable polling for table
  });

  const pages = data?.pages || initialData || [];
  const totalPages = data?.totalPages || 0;

  const toggleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
    setPage(0);
  };

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(0);
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <CardTitle className="text-base font-medium">Page Performance</CardTitle>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search pages..."
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-8 w-full sm:w-[200px]"
              />
            </div>
            <Select value={sortBy} onValueChange={(v) => { setSortBy(v); setPage(0); }}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pageLoads">Page Loads</SelectItem>
                <SelectItem value="performanceScore">Score</SelectItem>
                <SelectItem value="opportunity">Opportunity</SelectItem>
                <SelectItem value="lcp">LCP</SelectItem>
                <SelectItem value="inp">INP</SelectItem>
                <SelectItem value="cls">CLS</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px]">Page</TableHead>
                <TableHead className="text-center">
                  <SortableHeader
                    label="Score"
                    field="performanceScore"
                    currentSort={sortBy}
                    sortOrder={sortOrder}
                    onSort={toggleSort}
                  />
                </TableHead>
                <TableHead className="text-center">
                  <SortableHeader
                    label="Opportunity"
                    field="opportunity"
                    currentSort={sortBy}
                    sortOrder={sortOrder}
                    onSort={toggleSort}
                  />
                </TableHead>
                <TableHead className="text-center">LCP</TableHead>
                <TableHead className="text-center">INP</TableHead>
                <TableHead className="text-center">CLS</TableHead>
                <TableHead className="text-center">FCP</TableHead>
                <TableHead className="text-center">TTFB</TableHead>
                <TableHead className="text-right">
                  <SortableHeader
                    label="Page Loads"
                    field="pageLoads"
                    currentSort={sortBy}
                    sortOrder={sortOrder}
                    onSort={toggleSort}
                  />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <div className="h-4 w-32 bg-muted rounded animate-pulse" />
                    </TableCell>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <TableCell key={j} className="text-center">
                        <div className="h-4 w-12 bg-muted rounded animate-pulse mx-auto" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : pages.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No pages found
                  </TableCell>
                </TableRow>
              ) : (
                pages.map((pageData) => (
                  <PageRow key={pageData.path} page={pageData} />
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > limit && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <p className="text-sm text-muted-foreground">
              Showing {page * limit + 1}-{Math.min((page + 1) * limit, totalPages)} of{" "}
              {totalPages} pages
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                disabled={(page + 1) * limit >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SortableHeader({
  label,
  field,
  currentSort,
  sortOrder,
  onSort,
}: {
  label: string;
  field: string;
  currentSort: string;
  sortOrder: "asc" | "desc";
  onSort: (field: string) => void;
}) {
  const isActive = currentSort === field;

  return (
    <button
      className="flex items-center gap-1 hover:text-foreground transition-colors"
      onClick={() => onSort(field)}
    >
      {label}
      <ArrowUpDown
        className={`h-3 w-3 ${isActive ? "text-foreground" : "text-muted-foreground"}`}
      />
    </button>
  );
}

function PageRow({ page }: { page: PageWebVitals }) {
  return (
    <TableRow className="hover:bg-muted/50">
      <TableCell>
        <div className="flex flex-col">
          <span className="font-medium truncate max-w-[200px]" title={page.path}>
            {page.path}
          </span>
          {page.title && (
            <span className="text-xs text-muted-foreground truncate max-w-[200px]">
              {page.title}
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className="text-center">
        <ScoreBadge score={page.performanceScore} />
      </TableCell>
      <TableCell className="text-center">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center justify-center gap-1 cursor-help">
                <TrendingUp className="h-3 w-3 text-blue-500" />
                <span className="text-sm font-medium">+{page.opportunity}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">
                Potential score improvement if this page reaches 100
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </TableCell>
      <TableCell className="text-center">
        <MetricCell vital={page.lcp} name="LCP" />
      </TableCell>
      <TableCell className="text-center">
        <MetricCell vital={page.inp} name="INP" />
      </TableCell>
      <TableCell className="text-center">
        <MetricCell vital={page.cls} name="CLS" />
      </TableCell>
      <TableCell className="text-center">
        <MetricCell vital={page.fcp} name="FCP" />
      </TableCell>
      <TableCell className="text-center">
        <MetricCell vital={page.ttfb} name="TTFB" />
      </TableCell>
      <TableCell className="text-right">
        <span className="text-sm">{page.pageLoads.toLocaleString()}</span>
      </TableCell>
    </TableRow>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const variant = useMemo(() => {
    if (score >= 90) return "bg-green-500/10 text-green-600 dark:text-green-400";
    if (score >= 50) return "bg-orange-500/10 text-orange-600 dark:text-orange-400";
    return "bg-red-500/10 text-red-600 dark:text-red-400";
  }, [score]);

  return (
    <Badge variant="outline" className={`${variant} font-bold`}>
      {score}
    </Badge>
  );
}

function MetricCell({
  vital,
  name,
}: {
  vital: { p75: number; rating: WebVitalRating } | null;
  name: "LCP" | "INP" | "CLS" | "FCP" | "TTFB";
}) {
  const colorClass = useMemo(() => {
    if (!vital) return "text-muted-foreground";
    switch (vital.rating) {
      case "good":
        return "text-green-600 dark:text-green-400";
      case "needs-improvement":
        return "text-orange-600 dark:text-orange-400";
      case "poor":
        return "text-red-600 dark:text-red-400";
      default:
        return "text-muted-foreground";
    }
  }, [vital]);

  if (!vital) {
    return <span className="text-muted-foreground">-</span>;
  }

  return (
    <span className={`text-sm font-medium ${colorClass}`}>
      {formatMetricValue(name, vital.p75)}
    </span>
  );
}
