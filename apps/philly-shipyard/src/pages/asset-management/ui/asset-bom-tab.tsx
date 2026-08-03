import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Package, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { CraneComponent } from '@crane/domain/asset';
import { Badge } from '@crane/ui/atoms/badge';
import { StatusDot } from '@crane/ui/atoms/status-dot';
import { cn } from '@crane/core/lib/utils';
import { TABLE_EMPTY } from '../../../shared/ui/page';
import { SURFACE_PANEL } from '../../../shared/ui/surface';
import { PILL_INACTIVE, TONE_DOT, TONE_PILL_ACTIVE, TONE_TEXT } from '../../../shared/ui/tone';
import { FOCUS_RING, searchInputClass } from '../../../shared/ui/controls';
import {
  COMPONENT_STATUS_DOT,
  COMPONENT_STATUS_VARIANT,
} from '../../../shared/ui/status-variants';
import {
  usedLifePercent,
  remainingLifePercent,
  lifeTone,
} from '../../../shared/lib/component-life';

/** 잎 컴포넌트 id(`comp-{craneId}-part-{partId}`)에서 인벤토리 partId를 추출 */
function partIdFromComponent(c: CraneComponent): string | null {
  const marker = '-part-';
  const i = c.id.indexOf(marker);
  return i >= 0 ? c.id.slice(i + marker.length) : null;
}

// ── 컴팩트 부품 행 (인벤토리 딥링크) ──
function PartLeafRow({ component }: { component: CraneComponent }) {
  const { t } = useTranslation('asset-management');
  // 화면 표기는 앱 전역 규칙대로 잔여율 — 톤 임계값만 사용률 기준
  const remainingPct = remainingLifePercent(component);
  const tone = lifeTone(usedLifePercent(component));
  const partId = partIdFromComponent(component);

  const inner = (
    <>
      <StatusDot status={COMPONENT_STATUS_DOT[component.status]} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium">{component.componentName}</p>
        {component.partNumber && (
          <p className="truncate font-mono text-[10px] text-muted-foreground">
            {component.partNumber}
          </p>
        )}
      </div>
      <div
        className="flex w-24 shrink-0 items-center gap-1.5"
        title={t('detail.zonePanel.remainingLife', { defaultValue: '잔여 수명' })}
      >
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className={cn('h-full rounded-full', TONE_DOT[tone])}
            style={{ width: `${remainingPct}%` }}
          />
        </div>
        <span className={cn('w-8 shrink-0 text-right text-[10px] font-semibold tabular-nums', TONE_TEXT[tone])}>
          {remainingPct}%
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
  // 클러스터 헤더에는 가장 소모가 심한 자식의 잔여율을 보여준다
  const worstRemainingPct = parts.reduce(
    (min, c) => Math.min(min, remainingLifePercent(c)),
    100,
  );

  return (
    <div className={cn(SURFACE_PANEL, 'overflow-hidden')}>
      <button
        type="button"
        onClick={onToggle}
        disabled={forceOpen}
        aria-expanded={isOpen}
        className={cn(FOCUS_RING, 
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
        {parts.length > 0 && worstRemainingPct < 100 && (
          <span
            className={cn(
              'shrink-0 text-[11px] font-semibold tabular-nums',
              worstRemainingPct <= 10
                ? TONE_TEXT.critical
                : worstRemainingPct <= 30
                  ? TONE_TEXT.warning
                  : 'text-muted-foreground',
            )}
          >
            {worstRemainingPct}%
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

// ── 탭: 구성품 (BOM) — 검색/이슈 필터 + 클러스터 트리 ──
export function AssetBomTab({
  components,
  stats,
}: {
  components: CraneComponent[];
  stats: { total: number; issues: number };
}) {
  const { t } = useTranslation('asset-management');
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
        // 매칭 자식이 있거나, (검색 중일 때) 클러스터명이 검색어와 일치하는 경우만.
        // q가 빈 문자열이면 includes('')가 항상 참이 되어 "이상 항목만"이 무력화되므로 q 가드 필수.
        return children.length > 0 || (q !== '' && root.componentName.toLowerCase().includes(q));
      });
  }, [rootComponents, childrenByParent, query, onlyIssues, filterActive]);

  return (
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
            className={cn(searchInputClass, 'w-72 pl-8 pr-3')}
          />
        </div>
        <button
          type="button"
          onClick={() => setOnlyIssues((v) => !v)}
          className={cn(
            'inline-flex cursor-pointer items-center gap-1.5 rounded px-3 py-1.5 text-[11px] font-medium tracking-wider transition-all',
            FOCUS_RING,
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
        <div className={cn(TABLE_EMPTY, 'rounded-lg border border-dashed border-border/70')}>
          {t('detail.noBomData')}
        </div>
      ) : filteredClusters.length === 0 ? (
        <div className={cn(TABLE_EMPTY, 'rounded-lg border border-dashed border-border/70')}>
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
  );
}
