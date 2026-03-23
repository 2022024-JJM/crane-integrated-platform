import type { ReactNode } from 'react';

import { cn } from '@/shared/lib/utils';
import { Skeleton } from '@/shared/ui/atoms/skeleton';
import { Separator } from '@/shared/ui/atoms/separator';

export function DashboardMetricSkeleton() {
  return (
    <div className="ml-1 space-y-2 py-1">
      <Skeleton className="h-8 w-20 rounded-xl" />
      <Skeleton className="h-3 w-28" />
    </div>
  );
}

export function DashboardChartSkeleton({
  variant,
  statsCount,
  columnsClassName,
  chartClassName,
}: {
  variant: 'line' | 'bars';
  statsCount: number;
  columnsClassName?: string;
  chartClassName?: string;
}) {
  return (
    <div className="space-y-4">
      <ChartSkeletonFrame className={chartClassName}>
        {variant === 'line' ? <LineChartGhost /> : <VerticalBarsGhost />}
      </ChartSkeletonFrame>
      <Separator />
      <div
        className={cn(
          'grid grid-cols-2 gap-4 text-sm md:grid-cols-2',
          columnsClassName,
        )}
      >
        {Array.from({ length: statsCount }, (_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-16 rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardRegionStatusSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="flex items-center gap-2">
            <Skeleton className="size-2 rounded-full" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="border-border/70 bg-card/70 rounded-2xl border p-3"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="size-4" />
            </div>
            <Skeleton className="mt-3 h-3 w-full rounded-full" />
            <div className="mt-3 grid grid-cols-3 gap-2">
              {Array.from({ length: 3 }, (_, statusIndex) => (
                <div
                  key={statusIndex}
                  className="bg-muted/50 rounded-xl px-2.5 py-2"
                >
                  <Skeleton className="h-3 w-10" />
                  <Skeleton className="mt-2 h-5 w-8" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardRiskCranesSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <ChartSkeletonFrame className="h-[220px]">
        <HorizontalBarsGhost />
      </ChartSkeletonFrame>
      <Separator />
      <div className="space-y-2">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="border-border/70 bg-card/70 rounded-2xl border p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-18" />
              </div>
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {Array.from({ length: 3 }, (_, statIndex) => (
                <div key={statIndex} className="space-y-2">
                  <Skeleton className="h-3 w-14" />
                  <Skeleton className="h-4 w-12" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChartSkeletonFrame({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'border-border/60 bg-muted/20 relative h-[240px] w-full overflow-hidden rounded-2xl border border-dashed p-4',
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-x-4 top-6 space-y-10">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-px w-full rounded-full" />
        ))}
      </div>
      <div className="relative flex h-full items-end">{children}</div>
    </div>
  );
}

function LineChartGhost() {
  return (
    <div className="flex h-full w-full items-end justify-between gap-3">
      {['35%', '54%', '44%', '62%', '58%', '74%'].map((height, index) => (
        <div
          key={index}
          className="flex h-full flex-1 items-end justify-center"
        >
          <Skeleton
            className="w-full max-w-10 rounded-full"
            style={{ height }}
          />
        </div>
      ))}
    </div>
  );
}

function VerticalBarsGhost() {
  return (
    <div className="flex h-full w-full items-end justify-between gap-3">
      {['40%', '52%', '66%', '45%', '71%', '58%'].map((height, index) => (
        <div
          key={index}
          className="flex h-full flex-1 items-end justify-center"
        >
          <Skeleton
            className="w-full max-w-9 rounded-t-xl rounded-b-sm"
            style={{ height }}
          />
        </div>
      ))}
    </div>
  );
}

function HorizontalBarsGhost() {
  return (
    <div className="flex h-full w-full flex-col justify-center gap-4">
      {['88%', '76%', '64%', '52%', '40%'].map((width, index) => (
        <div key={index} className="flex items-center gap-3">
          <Skeleton className="h-3 w-12" />
          <Skeleton
            className="h-7 rounded-l-sm rounded-r-xl"
            style={{ width }}
          />
        </div>
      ))}
    </div>
  );
}
