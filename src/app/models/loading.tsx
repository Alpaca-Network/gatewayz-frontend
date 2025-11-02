import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";

const ModelCardSkeleton = () => {
  return (
    <div className="w-full group">
      <Card className="p-5 w-full relative overflow-hidden border-muted/50 bg-gradient-to-br from-card to-card/50">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent animate-shimmer"
             style={{ backgroundSize: '1000px 100%' }} />

        <div className="relative z-10">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Skeleton className="h-5 w-48 bg-gradient-to-r from-muted via-muted/60 to-muted animate-pulse-glow" />
              </div>
              <Skeleton className="h-5 w-24 bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20 animate-pulse-glow" />
            </div>
            <Skeleton className="h-4 w-12 bg-muted/80 animate-pulse-glow" />
          </div>
          <div className="mb-4 space-y-2">
            <Skeleton className="h-4 w-full bg-muted/70 animate-pulse-glow" style={{ animationDelay: '0.1s' }} />
            <Skeleton className="h-4 w-2/3 bg-muted/70 animate-pulse-glow" style={{ animationDelay: '0.2s' }} />
          </div>
          <div className="flex items-center gap-3 pt-3 border-t border-muted/30">
            <Skeleton className="h-3 w-20 bg-muted/60 animate-pulse-glow" style={{ animationDelay: '0.3s' }} />
            <Skeleton className="h-3 w-16 bg-muted/60 animate-pulse-glow" style={{ animationDelay: '0.4s' }} />
            <Skeleton className="h-3 w-16 bg-muted/60 animate-pulse-glow" style={{ animationDelay: '0.5s' }} />
          </div>
        </div>
      </Card>
    </div>
  );
};

export default function ModelsLoading() {
  return (
    <SidebarProvider>
      <div className="relative flex w-full h-[calc(100vh-theme(spacing.14))]">
        <Sidebar
          variant="sidebar"
          collapsible="icon"
          className="hidden lg:flex"
        >
          <SidebarContent className="p-4">
            <SidebarGroup>
              <SidebarGroupLabel>Input Modalities</SidebarGroupLabel>
              <div className="flex flex-col gap-2">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-full" />
              </div>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>Context Length</SidebarGroupLabel>
              <Skeleton className="h-2 w-full" />
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>Prompt Pricing</SidebarGroupLabel>
              <Skeleton className="h-2 w-full" />
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        <SidebarInset className="flex-1 overflow-auto">
          <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-32" />
              </div>
              <div className="flex items-center gap-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-9 w-24" />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full sm:w-[180px]" />
              <Skeleton className="h-10 w-24" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6">
              {Array.from({ length: 12 }).map((_, i) => (
                <ModelCardSkeleton key={i} />
              ))}
            </div>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
