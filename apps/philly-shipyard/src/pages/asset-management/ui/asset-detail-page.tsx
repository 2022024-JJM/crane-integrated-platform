import { lazy, Suspense, useMemo } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { ChevronLeft, Wrench } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAssetDetail } from '@crane/features/asset';
import { useCraneHistory } from '@crane/features/history';
import type { ComponentStatus } from '@crane/domain/asset';
import { Badge } from '@crane/ui/atoms/badge';
import { StatusDot } from '@crane/ui/atoms/status-dot';
import { cn } from '@crane/core/lib/utils';
import { PAGE_CONTAINER, PAGE_TITLE } from '../../../shared/ui/page';
import { SURFACE_PANEL } from '../../../shared/ui/surface';
import { TONE_DOT, TONE_TEXT, type Tone } from '../../../shared/ui/tone';
import { ASSET_STATUS_DOT, ASSET_STATUS_VARIANT } from '../../../shared/ui/status-variants';
import { formatRelativeDate } from '../../../shared/lib/relative-date';
import { usedLifePercent } from '../../../shared/lib/component-life';
import { AssetBomTab } from './asset-bom-tab';
import { AssetConditionTab } from './asset-condition-tab';
import { AssetInspectionTab } from './asset-inspection-tab';
import { AssetMaintenanceTab } from './asset-maintenance-tab';
import { AssetHistoryTab } from './asset-history-tab';
import { AssetSpecsTab } from './asset-specs-tab';
import { FOCUS_RING } from '../../../shared/ui/controls';

// 3D 탭은 three.js 의존 — 탭을 열 때만 청크를 로드하도록 lazy 분리
const Asset3dTab = lazy(() =>
  import('./asset-3d-tab').then((m) => ({ default: m.Asset3dTab })),
);

type DetailTab = 'overview' | 'condition' | '3d' | 'inspection' | 'maintenance' | 'history' | 'specs';

const DETAIL_TABS: DetailTab[] = ['overview', 'condition', '3d', 'inspection', 'maintenance', 'history', 'specs'];

function isDetailTab(value: string | null): value is DetailTab {
  return value !== null && (DETAIL_TABS as string[]).includes(value);
}

const ACTIVE_REPAIR_STATUSES = new Set([
  'received',
  'waiting_parts',
  'in_progress',
  're_inspection',
]);

// 비정상 상태별 톤 (심각도 높은 순)
const ISSUE_TONES: { key: ComponentStatus; tone: Tone }[] = [
  { key: 'replace', tone: 'critical' },
  { key: 'critical', tone: 'critical' },
  { key: 'warning', tone: 'warning' },
  { key: 'caution', tone: 'warning' },
];

export function AssetDetailPage() {
  const { craneId } = useParams<{ craneId: string }>();
  const { asset, components, inspections, repairs } = useAssetDetail(craneId ?? '');
  const history = useCraneHistory(craneId ?? '');
  const { t } = useTranslation('asset-management');
  // ?tab= 딥링크 (목록 카드 3D 버튼 → ?tab=3d) — 새로고침에도 탭 유지
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab: DetailTab = isDetailTab(tabParam) ? tabParam : 'overview';
  const setActiveTab = (tab: DetailTab) => {
    const next = new URLSearchParams(searchParams);
    if (tab === 'overview') next.delete('tab');
    else next.set('tab', tab);
    setSearchParams(next, { replace: true });
  };

  // 잎 컴포넌트 상태 집계 (요약 밴드)
  const stats = useMemo(() => {
    const leaves = components.filter((c) => c.parentId !== null);
    const counts: Record<ComponentStatus, number> = {
      normal: 0,
      caution: 0,
      warning: 0,
      critical: 0,
      replace: 0,
    };
    for (const c of leaves) counts[c.status] += 1;
    const issues = leaves.length - counts.normal;
    return { total: leaves.length, counts, issues };
  }, [components]);

  const overdueInspections = inspections.filter((w) => w.status === 'overdue').length;
  const activeRepairs = repairs.filter((w) => ACTIVE_REPAIR_STATUSES.has(w.status)).length;
  const openWo = overdueInspections + activeRepairs;

  // 수명 소모 70% 이상 루트 클러스터 수 — Condition 탭 배지
  const clustersAtRisk = useMemo(
    () =>
      components.filter((c) => c.parentId === null && usedLifePercent(c) >= 70).length,
    [components],
  );

  const nextInspection = useMemo(() => {
    const upcoming = inspections
      .filter((w) => w.status !== 'completed' && w.status !== 'cancelled')
      .map((w) => w.scheduledDate)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    return upcoming[0];
  }, [inspections]);

  if (!asset) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-muted-foreground">{t('detail.notFound')}</p>
      </div>
    );
  }

  const tabs: { key: DetailTab; count?: number }[] = [
    { key: 'overview', count: stats.issues > 0 ? stats.issues : undefined },
    { key: 'condition', count: clustersAtRisk || undefined },
    { key: '3d' },
    { key: 'inspection', count: inspections.length || undefined },
    { key: 'maintenance', count: repairs.length || undefined },
    { key: 'history', count: history.length || undefined },
    { key: 'specs' },
  ];

  const nextInspRel = nextInspection ? formatRelativeDate(nextInspection) : null;

  return (
    <div className={PAGE_CONTAINER}>
      {/* 뒤로 */}
      <Link
        to="/asset-management"
        className="flex w-fit cursor-pointer items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        {t('title')}
      </Link>

      {/* 요약 헤더 밴드 */}
      <div className={cn(SURFACE_PANEL, 'flex flex-col gap-4 p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between')}>
        <div className="min-w-0 space-y-1.5">
          <div className="flex items-center gap-2">
            <StatusDot status={ASSET_STATUS_DOT[asset.status]} />
            <h1 className={cn(PAGE_TITLE, 'truncate')}>{asset.name}</h1>
            <Badge variant={ASSET_STATUS_VARIANT[asset.status]} className="shrink-0">
              {t(`status.${asset.status}`)}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {asset.craneType.toUpperCase()} · {asset.capacityTon}
            {t('units.ton')} · {asset.manufacturer} {asset.model}
            <span className="mx-1.5 text-border">|</span>
            {asset.siteName} · {asset.locationZone}
          </p>
        </div>

        {/* 요약 지표 */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* 구성품 상태 롤업 */}
          <div className="flex flex-col gap-1 rounded-md border border-border/60 bg-muted/30 px-3 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t('detail.componentHealth.title')}
            </span>
            {stats.issues > 0 ? (
              <span className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px]">
                {ISSUE_TONES.map(({ key, tone }) => {
                  const n = stats.counts[key];
                  if (n === 0) return null;
                  return (
                    <span key={key} className={cn('flex items-center gap-1 font-semibold', TONE_TEXT[tone])}>
                      <span className={cn('size-1.5 rounded-full', TONE_DOT[tone])} />
                      {t(`detail.componentHealth.${key}`)} {n}
                    </span>
                  );
                })}
                <span className="text-muted-foreground tabular-nums">/ {stats.total}</span>
              </span>
            ) : (
              <span className={cn('text-[11px] font-semibold', TONE_TEXT.positive)}>
                {t('card.allNormal', { defaultValue: 'All Normal' })}
                <span className="ml-1 font-normal text-muted-foreground tabular-nums">
                  ({stats.total})
                </span>
              </span>
            )}
          </div>

          {/* 미결 WO */}
          <div className="flex flex-col gap-1 rounded-md border border-border/60 bg-muted/30 px-3 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t('card.openWo', { defaultValue: 'Open WO' })}
            </span>
            <span
              className={cn(
                'flex items-center gap-1.5 text-sm font-semibold tabular-nums',
                openWo > 0 ? TONE_TEXT.warning : 'text-foreground',
              )}
            >
              <Wrench className="size-3.5" />
              {openWo}
              <span className="text-[11px] font-normal text-muted-foreground">
                {openWo > 0
                  ? t('card.woBreakdown', {
                      overdue: overdueInspections,
                      repair: activeRepairs,
                      defaultValue: `${overdueInspections} insp · ${activeRepairs} repair`,
                    })
                  : ''}
              </span>
            </span>
          </div>

          {/* 다음 점검 */}
          <div className="flex flex-col gap-1 rounded-md border border-border/60 bg-muted/30 px-3 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t('card.nextInspection', { defaultValue: 'Next Inspection' })}
            </span>
            {nextInspRel ? (
              <span
                className={cn(
                  'text-sm font-semibold tabular-nums',
                  nextInspRel.overdue ? TONE_TEXT.critical : 'text-foreground',
                )}
              >
                {nextInspRel.label}
                <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
                  {nextInspection}
                </span>
              </span>
            ) : (
              <span className="text-sm font-semibold text-muted-foreground">—</span>
            )}
          </div>
        </div>
      </div>

      {/* 탭 */}
      <div role="tablist" className="flex gap-1 border-b border-border">
        {tabs.map(({ key, count }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={activeTab === key}
            onClick={() => setActiveTab(key)}
            className={cn(FOCUS_RING, 
              'cursor-pointer border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
              activeTab === key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t(`detail.tabs.${key}`)}
            {count !== undefined && (
              <span className="ml-1.5 tabular-nums text-muted-foreground">{count}</span>
            )}
          </button>
        ))}
      </div>

      {/* 탭 본문 */}
      <div role="tabpanel">
        {/* 탭: 3D 뷰 (구역 선택 → 부품 재원) — three.js 청크 lazy 로드 */}
        {activeTab === '3d' && (
          <Suspense
            fallback={<div className="h-[420px] animate-pulse rounded-lg bg-muted/40 lg:h-[600px]" />}
          >
            <Asset3dTab asset={asset} components={components} />
          </Suspense>
        )}

        {/* 탭: 구성품 (BOM) */}
        {activeTab === 'overview' && <AssetBomTab components={components} stats={stats} />}

        {/* 탭: 부품 수명 (TRUCONNECT Condition 벤치마크) */}
        {activeTab === 'condition' && (
          <AssetConditionTab asset={asset} components={components} />
        )}

        {/* 탭: 점검 이력 */}
        {activeTab === 'inspection' && <AssetInspectionTab inspections={inspections} />}

        {/* 탭: 정비 이력 */}
        {activeTab === 'maintenance' && <AssetMaintenanceTab repairs={repairs} />}

        {/* 탭: 통합 이력 — 점검·수리·부품요청 타임라인 */}
        {activeTab === 'history' && <AssetHistoryTab events={history} />}

        {/* 탭: 제원 */}
        {activeTab === 'specs' && <AssetSpecsTab asset={asset} />}
      </div>
    </div>
  );
}
