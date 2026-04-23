import { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import {
  getCraneIdsByRegion,
  getCraneById,
  getCmmsMockData,
} from '@crane/domain/crane';
import {
  getStorageItem,
  setStorageItem,
} from '@crane/core/lib/safe-storage';
import { CraneSummaryCard } from './crane-summary-card';

type StatusFilter = 'RUN' | 'FAULT' | 'STOP';

interface CraneListSectionProps {
  title: string;
  subtitle: string;
  regionId: string;
  statusFilters?: Set<StatusFilter>;
  globalCollapsed?: boolean | null;
  onLocalToggle?: () => void;
}

function useLocalCollapsed(key: string, defaultValue = false) {
  const storageKey = `crane-section-collapsed:${key}`;
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    const stored = getStorageItem(storageKey);
    return stored !== null ? stored === 'true' : defaultValue;
  });

  const toggle = () =>
    setCollapsed((prev) => {
      const next = !prev;
      setStorageItem(storageKey, String(next));
      return next;
    });

  return [collapsed, toggle] as const;
}

export function CraneListSection({
  title,
  subtitle,
  regionId,
  statusFilters,
  globalCollapsed = null,
  onLocalToggle,
}: CraneListSectionProps) {
  const craneIds = getCraneIdsByRegion(regionId);
  const allCranes = craneIds
    .map((id) => getCraneById(id))
    .filter((c): c is NonNullable<typeof c> => c != null);

  const [localCollapsed, localToggle] = useLocalCollapsed(regionId);

  // globalCollapsed가 null이면 로컬 상태 사용, 아니면 전역 우선
  const collapsed = globalCollapsed !== null ? globalCollapsed : localCollapsed;

  const handleToggle = () => {
    onLocalToggle?.();
    localToggle();
  };

  // 필터 적용 (빈 Set = 전체 표시) — hide 방식으로 처리해 카드 expanded state 보존
  const visibleSet = useMemo(() => {
    if (!statusFilters || statusFilters.size === 0) return null; // null = 전체 표시
    return new Set(
      allCranes
        .filter((crane) => {
          const mock = getCmmsMockData(crane.craneId);
          const status = mock.overview.machines[0].runFault as StatusFilter;
          return statusFilters.has(status);
        })
        .map((c) => c.craneId),
    );
  }, [allCranes, statusFilters]);

  if (allCranes.length === 0) return null;

  const visibleCount = visibleSet ? visibleSet.size : allCranes.length;

  return (
    <section>
      {/* 섹션 헤더 */}
      <button
        type="button"
        onClick={handleToggle}
        className="group flex w-full items-center gap-3 mb-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
      >
        <div className="w-1 h-5 rounded-full bg-primary shrink-0" />
        <div className="flex items-baseline gap-2 min-w-0">
          <h2 className="text-base font-bold text-foreground">{title}</h2>
          <span className="text-xs text-muted-foreground">{subtitle}</span>
        </div>
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground tabular-nums shrink-0">
          {(!statusFilters || statusFilters.size === 0)
            ? `${allCranes.length}기`
            : `${visibleCount} / ${allCranes.length}기`}
        </span>
        <div className="flex items-center justify-center size-6 rounded border border-border bg-muted/50 text-muted-foreground transition-colors group-hover:bg-muted group-hover:text-foreground shrink-0">
          {collapsed
            ? <ChevronDown className="size-3.5" />
            : <ChevronUp   className="size-3.5" />
          }
        </div>
      </button>

      {/* 카드 그리드 */}
      {!collapsed && (
        visibleCount > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 pb-4">
            {allCranes.map((crane) => (
              <div
                key={crane.craneId}
                className={visibleSet && !visibleSet.has(crane.craneId) ? 'hidden' : undefined}
              >
                <CraneSummaryCard crane={crane} />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center py-8 pb-4 text-xs text-muted-foreground">
            해당 상태의 크레인이 없습니다.
          </div>
        )
      )}
    </section>
  );
}
