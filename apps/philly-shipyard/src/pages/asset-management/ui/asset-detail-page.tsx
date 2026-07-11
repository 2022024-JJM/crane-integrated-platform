import { useMemo, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Package,
  Search,
  Wrench,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAssetDetail } from '@crane/features/asset';
import type { ComponentStatus, CraneComponent } from '@crane/domain/asset';
import type { InspectionStatus } from '@crane/domain/inspection';
import type { RepairPriority } from '@crane/domain/maintenance';
import { Badge } from '@crane/ui/atoms/badge';
import { StatusDot } from '@crane/ui/atoms/status-dot';
import { cn } from '@crane/core/lib/utils';
import {
  PILL_INACTIVE,
  TONE_DOT,
  TONE_PILL_ACTIVE,
  TONE_TEXT,
  type Tone,
} from '../../../shared/ui/tone';
import { Asset3dTab } from './asset-3d-tab';

type DetailTab = 'overview' | '3d' | 'inspection' | 'maintenance' | 'specs';

const DETAIL_TABS: DetailTab[] = ['overview', '3d', 'inspection', 'maintenance', 'specs'];

function isDetailTab(value: string | null): value is DetailTab {
  return value !== null && (DETAIL_TABS as string[]).includes(value);
}

const ACTIVE_REPAIR_STATUSES = new Set([
  'received',
  'waiting_parts',
  'in_progress',
  're_inspection',
]);

function formatRelativeDate(dateStr: string): { label: string; overdue: boolean } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return { label: 'D-Day', overdue: false };
  if (diff > 0) return { label: `D-${diff}`, overdue: false };
  return { label: `D+${Math.abs(diff)}`, overdue: true };
}

const COMPONENT_STATUS_VARIANT: Record<ComponentStatus, 'success' | 'warning' | 'destructive' | 'secondary'> = {
  normal: 'success',
  caution: 'warning',
  warning: 'warning',
  critical: 'destructive',
  replace: 'destructive',
};

const COMPONENT_DOT: Record<ComponentStatus, 'normal' | 'warning' | 'critical'> = {
  normal: 'normal',
  caution: 'warning',
  warning: 'warning',
  critical: 'critical',
  replace: 'critical',
};

const INSP_STATUS_VARIANT: Record<InspectionStatus, 'secondary' | 'warning' | 'success' | 'destructive'> = {
  scheduled: 'secondary',
  in_progress: 'warning',
  completed: 'success',
  overdue: 'destructive',
  cancelled: 'secondary',
};

const INSP_RESULT_VARIANT: Record<string, 'success' | 'destructive' | 'warning'> = {
  pass: 'success',
  fail: 'destructive',
  conditional: 'warning',
};

const REPAIR_PRIORITY_VARIANT: Record<RepairPriority, 'destructive' | 'warning' | 'secondary'> = {
  emergency: 'destructive',
  high: 'warning',
  normal: 'secondary',
  low: 'secondary',
};

const REPAIR_STATUS_VARIANT: Record<string, 'secondary' | 'warning' | 'success' | 'destructive'> = {
  received: 'secondary',
  waiting_parts: 'destructive',
  in_progress: 'warning',
  re_inspection: 'warning',
  completed: 'success',
};

// 비정상 상태별 톤 (심각도 높은 순)
const ISSUE_TONES: { key: ComponentStatus; tone: Tone }[] = [
  { key: 'replace', tone: 'critical' },
  { key: 'critical', tone: 'critical' },
  { key: 'warning', tone: 'warning' },
  { key: 'caution', tone: 'warning' },
];

function lifePercent(component: CraneComponent) {
  if (component.expectedLifeHours === 0) return 0;
  return Math.min(100, Math.round((component.currentHours / component.expectedLifeHours) * 100));
}

/** 잎 컴포넌트 id(`comp-{craneId}-part-{partId}`)에서 인벤토리 partId를 추출 */
function partIdFromComponent(c: CraneComponent): string | null {
  const marker = '-part-';
  const i = c.id.indexOf(marker);
  return i >= 0 ? c.id.slice(i + marker.length) : null;
}

// ── 컴팩트 부품 행 (인벤토리 딥링크) ──
function PartLeafRow({ component }: { component: CraneComponent }) {
  const { t } = useTranslation('asset-management');
  const pct = lifePercent(component);
  const lifeTone: Tone = pct >= 90 ? 'critical' : pct >= 70 ? 'warning' : 'positive';
  const partId = partIdFromComponent(component);

  const inner = (
    <>
      <StatusDot status={COMPONENT_DOT[component.status]} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium">{component.componentName}</p>
        {component.partNumber && (
          <p className="truncate font-mono text-[10px] text-muted-foreground">
            {component.partNumber}
          </p>
        )}
      </div>
      <div className="flex w-24 shrink-0 items-center gap-1.5">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
          <div className={cn('h-full rounded-full', TONE_DOT[lifeTone])} style={{ width: `${pct}%` }} />
        </div>
        <span className={cn('w-8 shrink-0 text-right text-[10px] font-semibold tabular-nums', TONE_TEXT[lifeTone])}>
          {pct}%
        </span>
      </div>
      {partId ? (
        <span className={cn('flex w-16 shrink-0 items-center justify-end gap-1 text-[10px] opacity-0 transition-opacity group-hover:opacity-100', TONE_TEXT.info)}>
          <Package className="size-3" />
          {t('detail.inStock', { defaultValue: 'Stock' })}
        </span>
      ) : (
        <span className="w-16 shrink-0" />
      )}
    </>
  );

  if (partId) {
    return (
      <Link
        to={`/inventory?part=${encodeURIComponent(partId)}`}
        className="group flex cursor-pointer items-center gap-2.5 rounded px-2.5 py-2 transition-colors hover:bg-muted/40"
        title={t('detail.viewInInventory', { defaultValue: 'View in inventory' })}
      >
        {inner}
      </Link>
    );
  }
  return <div className="flex items-center gap-2.5 px-2.5 py-2">{inner}</div>;
}

function ClusterBlock({
  cluster,
  parts,
  open,
  onToggle,
  forceOpen,
}: {
  cluster: CraneComponent;
  parts: CraneComponent[];
  open: boolean;
  onToggle: () => void;
  forceOpen: boolean;
}) {
  const { t } = useTranslation('asset-management');
  const isOpen = open || forceOpen;
  const worstChildPct = parts.reduce((max, c) => Math.max(max, lifePercent(c)), 0);

  return (
    <div className="overflow-hidden rounded-lg border border-border/80 bg-card/50">
      <button
        type="button"
        onClick={onToggle}
        disabled={forceOpen}
        aria-expanded={isOpen}
        className={cn(
          'flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors',
          !forceOpen && 'cursor-pointer hover:bg-muted/40',
        )}
      >
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-muted-foreground transition-transform',
            !isOpen && '-rotate-90',
          )}
        />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">
          {cluster.componentName}
        </span>
        {worstChildPct > 0 && (
          <span
            className={cn(
              'shrink-0 text-[11px] font-semibold tabular-nums',
              worstChildPct >= 90
                ? TONE_TEXT.critical
                : worstChildPct >= 70
                  ? TONE_TEXT.warning
                  : 'text-muted-foreground',
            )}
          >
            {worstChildPct}%
          </span>
        )}
        <Badge variant={COMPONENT_STATUS_VARIANT[cluster.status]} className="shrink-0">
          {t(`detail.component.status.${cluster.status}`)}
        </Badge>
        <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
          {t('detail.component.partsCount', { n: parts.length })}
        </span>
      </button>
      {isOpen && parts.length > 0 && (
        <div className="divide-y divide-border/40 border-t border-border/60 px-1.5 py-1">
          {parts.map((child) => (
            <PartLeafRow key={child.id} component={child} />
          ))}
        </div>
      )}
    </div>
  );
}

export function AssetDetailPage() {
  const { craneId } = useParams<{ craneId: string }>();
  const { asset, components, inspections, repairs } = useAssetDetail(craneId ?? '');
  const { t } = useTranslation('asset-management');
  const { t: tInspection } = useTranslation('inspection');
  const { t: tMaintenance } = useTranslation('maintenance');
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
  const [expandedClusters, setExpandedClusters] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [onlyIssues, setOnlyIssues] = useState(false);

  const toggleCluster = (id: string) => {
    setExpandedClusters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const rootComponents = useMemo(
    () => components.filter((c) => c.parentId === null),
    [components],
  );
  const childrenByParent = useMemo(() => {
    const map: Record<string, CraneComponent[]> = {};
    for (const c of components) {
      if (c.parentId) (map[c.parentId] ??= []).push(c);
    }
    return map;
  }, [components]);

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

  const nextInspection = useMemo(() => {
    const upcoming = inspections
      .filter((w) => w.status !== 'completed' && w.status !== 'cancelled')
      .map((w) => w.scheduledDate)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    return upcoming[0];
  }, [inspections]);

  // BOM 검색/필터 결과
  const filterActive = query.trim().length > 0 || onlyIssues;
  const filteredClusters = useMemo(() => {
    const q = query.trim().toLowerCase();
    const leafMatch = (c: CraneComponent) => {
      const matchQuery =
        q === '' ||
        c.componentName.toLowerCase().includes(q) ||
        (c.partNumber?.toLowerCase().includes(q) ?? false);
      const matchIssue = !onlyIssues || c.status !== 'normal';
      return matchQuery && matchIssue;
    };
    return rootComponents
      .map((root) => {
        const allChildren = childrenByParent[root.id] ?? [];
        const clusterNameMatch = q !== '' && root.componentName.toLowerCase().includes(q);
        // 클러스터명이 검색어와 일치하면 (이슈 필터 적용해) 전체 자식 표시
        const children =
          clusterNameMatch && !onlyIssues
            ? allChildren
            : allChildren.filter(leafMatch);
        return { root, children, allCount: allChildren.length };
      })
      .filter(({ children, root }) => {
        if (!filterActive) return true;
        // 필터 활성 시: 매칭 자식이 있거나 클러스터명이 일치하는 경우만
        return children.length > 0 || root.componentName.toLowerCase().includes(query.trim().toLowerCase());
      });
  }, [rootComponents, childrenByParent, query, onlyIssues, filterActive]);

  if (!asset) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-muted-foreground">{t('detail.notFound')}</p>
      </div>
    );
  }

  const tabs: { key: DetailTab; count?: number }[] = [
    { key: 'overview', count: stats.issues > 0 ? stats.issues : undefined },
    { key: '3d' },
    { key: 'inspection', count: inspections.length || undefined },
    { key: 'maintenance', count: repairs.length || undefined },
    { key: 'specs' },
  ];

  const specFields = [
    { label: t('detail.fields.craneType'), value: asset.craneType.toUpperCase() },
    { label: t('detail.fields.manufacturer'), value: asset.manufacturer },
    { label: t('detail.fields.model'), value: asset.model },
    { label: t('detail.fields.capacity'), value: `${asset.capacityTon} ${t('units.ton')}` },
    { label: t('detail.fields.span'), value: asset.spanM ? `${asset.spanM} ${t('units.meter')}` : '—' },
    { label: t('detail.fields.liftHeight'), value: asset.liftHeightM ? `${asset.liftHeightM} ${t('units.meter')}` : '—' },
    { label: t('detail.fields.serialNo'), value: asset.serialNumber },
    { label: t('detail.fields.site'), value: asset.siteName },
    { label: t('detail.fields.location'), value: asset.locationZone },
    { label: t('detail.fields.indoorOutdoor'), value: asset.indoorOutdoor },
    { label: t('detail.fields.installDate'), value: asset.installationDate },
    { label: t('detail.fields.manufactureDate'), value: asset.manufactureDate },
    { label: t('detail.fields.warrantyStart'), value: asset.warrantyStart },
    { label: t('detail.fields.warrantyEnd'), value: asset.warrantyEnd },
    { label: t('detail.fields.oshaClass'), value: asset.oshaClassification },
  ];

  const nextInspRel = nextInspection ? formatRelativeDate(nextInspection) : null;

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      {/* 뒤로 */}
      <Link
        to="/asset-management"
        className="flex w-fit cursor-pointer items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        {t('title')}
      </Link>

      {/* 요약 헤더 밴드 */}
      <div className="flex flex-col gap-4 rounded-lg border border-border/90 bg-card/60 p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 space-y-1.5">
          <div className="flex items-center gap-2">
            <StatusDot status={asset.status === 'operating' ? 'normal' : asset.status === 'repair' ? 'critical' : 'warning'} />
            <h1 className="truncate text-lg font-bold">{asset.name}</h1>
            <Badge variant={COMPONENT_STATUS_VARIANT.normal} className="shrink-0">
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
      <div className="flex gap-1 border-b border-border">
        {tabs.map(({ key, count }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={cn(
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

      {/* 탭: 3D 뷰 (구역 선택 → 부품 재원) */}
      {activeTab === '3d' && <Asset3dTab asset={asset} components={components} />}

      {/* 탭: 구성품 (BOM) */}
      {activeTab === 'overview' && (
        <div className="flex flex-col gap-4">
          {/* 검색 / 필터 */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('detail.bomSearch', { defaultValue: 'Search component / P/N' })}
                className="h-9 w-72 rounded border border-border bg-card/60 pl-8 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary/50"
              />
            </div>
            <button
              type="button"
              onClick={() => setOnlyIssues((v) => !v)}
              className={cn(
                'inline-flex cursor-pointer items-center gap-1.5 rounded px-3 py-1.5 text-[11px] font-medium tracking-wider transition-all',
                onlyIssues ? TONE_PILL_ACTIVE.warning : PILL_INACTIVE,
              )}
            >
              <span className={cn('size-1.5 rounded-full', TONE_DOT.warning)} />
              {t('detail.bomOnlyIssues', { defaultValue: 'Issues only' })}
              {stats.issues > 0 && (
                <span className={cn('font-mono tabular-nums', onlyIssues ? 'opacity-80' : 'opacity-60')}>
                  {stats.issues}
                </span>
              )}
            </button>
            <span className="text-xs text-muted-foreground tabular-nums">
              {t('detail.componentCount', {
                count: stats.total,
                defaultValue: `${stats.total} components`,
              })}
            </span>
          </div>

          {rootComponents.length === 0 ? (
            <div className="rounded border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
              {t('detail.noBomData')}
            </div>
          ) : filteredClusters.length === 0 ? (
            <div className="rounded border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
              {t('detail.noMatch', { defaultValue: 'No components match.' })}
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {filteredClusters.map(({ root, children }) => (
                <ClusterBlock
                  key={root.id}
                  cluster={root}
                  parts={children}
                  open={expandedClusters.has(root.id)}
                  onToggle={() => toggleCluster(root.id)}
                  forceOpen={filterActive}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 탭: 점검 이력 */}
      {activeTab === 'inspection' && (
        <div className="flex flex-col gap-2">
          {inspections.length === 0 ? (
            <div className="rounded border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
              {t('detail.noInspectionHistory')}
            </div>
          ) : (
            inspections.map((wo) => {
              const rel = formatRelativeDate(wo.scheduledDate);
              return (
                <Link
                  key={wo.id}
                  to={`/inspection/${wo.id}`}
                  className="group flex items-center gap-3 rounded border border-border/90 bg-card/70 px-3.5 py-3 transition-all hover:border-primary/40 hover:bg-card"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{wo.woNumber}</p>
                    <p className="text-xs text-muted-foreground">
                      <span className={cn('mr-1 font-semibold', rel.overdue ? TONE_TEXT.critical : 'text-foreground')}>
                        {rel.label}
                      </span>
                      {wo.scheduledDate}
                    </p>
                  </div>
                  <Badge variant={wo.woType === 'frequent' ? 'secondary' : 'warning'} className="shrink-0">
                    {tInspection(`type.${wo.woType}`)}
                  </Badge>
                  <Badge variant={INSP_STATUS_VARIANT[wo.status]} className="shrink-0">
                    {tInspection(`status.${wo.status}`)}
                  </Badge>
                  {wo.result ? (
                    <Badge variant={INSP_RESULT_VARIANT[wo.result]} className="shrink-0">
                      {tInspection(`result.${wo.result}`)}
                    </Badge>
                  ) : (
                    <span className="w-10 shrink-0 text-right text-xs text-muted-foreground">—</span>
                  )}
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
                </Link>
              );
            })
          )}
        </div>
      )}

      {/* 탭: 정비 이력 */}
      {activeTab === 'maintenance' && (
        <div className="flex flex-col gap-2">
          {repairs.length === 0 ? (
            <div className="rounded border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
              {t('detail.noMaintenanceHistory')}
            </div>
          ) : (
            repairs.map((wo) => (
              <Link
                key={wo.id}
                to={`/maintenance/${wo.id}`}
                className="group flex flex-col gap-1.5 rounded border border-border/90 bg-card/70 px-3.5 py-3 transition-all hover:border-primary/40 hover:bg-card"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">{wo.woNumber}</span>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Badge variant={REPAIR_PRIORITY_VARIANT[wo.priority]}>
                      {tMaintenance(`priority.${wo.priority}`).toUpperCase()}
                    </Badge>
                    <Badge variant={REPAIR_STATUS_VARIANT[wo.status]}>
                      {tMaintenance(`status.${wo.status}`)}
                    </Badge>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-foreground" />
                  </div>
                </div>
                <p className="truncate text-xs text-muted-foreground">{wo.componentName}</p>
                <p className="line-clamp-1 text-xs text-muted-foreground">{wo.failureDescription}</p>
                <p className="text-xs text-muted-foreground">
                  <span className="mr-1 font-semibold text-foreground">
                    {formatRelativeDate(wo.scheduledStart.slice(0, 10)).label}
                  </span>
                  {wo.scheduledStart.slice(0, 10)}
                </p>
              </Link>
            ))
          )}
        </div>
      )}

      {/* 탭: 제원 */}
      {activeTab === 'specs' && (
        <div className="rounded-lg border border-border/90 bg-card/60 p-5 shadow-sm">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
            {specFields.map(({ label, value }) => (
              <div key={label}>
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="mt-0.5 text-sm font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}
