import { getCraneIdsByRegion, getCraneById } from '@crane/domain/crane';
import { CraneSummaryCard } from './crane-summary-card';

interface CraneListSectionProps {
  title: string;
  subtitle: string;
  regionId: string;
}

export function CraneListSection({ title, subtitle, regionId }: CraneListSectionProps) {
  const craneIds = getCraneIdsByRegion(regionId);
  const cranes = craneIds
    .map((id) => getCraneById(id))
    .filter((c): c is NonNullable<typeof c> => c != null);

  if (cranes.length === 0) return null;

  return (
    <section className="pb-4">
      {/* 섹션 헤더 — 굵은 구분선 + 타이틀 */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-1 h-5 rounded-full bg-primary shrink-0" />
        <div className="flex items-baseline gap-2 min-w-0">
          <h2 className="text-base font-bold text-foreground">{title}</h2>
          <span className="text-xs text-muted-foreground">{subtitle}</span>
        </div>
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground tabular-nums shrink-0">
          {cranes.length}기
        </span>
      </div>

      {/* 카드 그리드 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 py-1">
        {cranes.map((crane) => (
          <CraneSummaryCard key={crane.craneId} crane={crane} />
        ))}
      </div>
    </section>
  );
}
