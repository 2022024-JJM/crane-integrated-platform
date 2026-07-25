import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronLeft, MousePointerClick, X } from 'lucide-react';
import type { CraneComponent } from '@crane/domain/asset';
import { Badge } from '@crane/ui/atoms/badge';
import { StatusDot } from '@crane/ui/atoms/status-dot';
import { cn } from '@crane/core/lib/utils';
import { SURFACE_PANEL } from '../../../shared/ui/surface';
import { PILL_INACTIVE, TONE_DOT, TONE_PILL_ACTIVE, TONE_TEXT } from '../../../shared/ui/tone';
import {
  COMPONENT_STATUS_DOT,
  COMPONENT_STATUS_VARIANT,
} from '../../../shared/ui/status-variants';
import { usedLifePercent as usedPercent, lifeTone } from '../../../shared/lib/component-life';
import { FOCUS_RING } from '../../../shared/ui/controls';

export interface ZoneClusterGroup {
  cluster: CraneComponent;
  parts: CraneComponent[];
}

interface ZoneSpecPanelProps {
  /** 존 key 목록 (viewer와 동일 순서) */
  zoneKeys: string[];
  selectedZoneKey: string | null;
  hoveredZoneKey: string | null;
  onZoneHover: (key: string | null) => void;
  onZoneSelect: (key: string | null) => void;
  /** 선택된 존의 클러스터 그룹 (존 미선택 시 빈 배열) */
  clusterGroups: ZoneClusterGroup[];
  selectedPart: CraneComponent | null;
  onSelectPart: (componentId: string | null) => void;
  hasBomData: boolean;
  className?: string;
}

/** 부품 재원 카드 — 존 패널에서 부품 선택 시 표시 */
function PartSpecCard({
  part,
  onBack,
}: {
  part: CraneComponent;
  onBack: () => void;
}) {
  const { t } = useTranslation('asset-management');
  const usedPct = usedPercent(part);
  const remainingPct = 100 - usedPct;
  const tone = lifeTone(usedPct);

  const rows = [
    { label: t('detail.zonePanel.partName', { defaultValue: '부품명' }), value: part.componentName },
    { label: t('detail.zonePanel.partNumber', { defaultValue: 'P/N' }), value: part.partNumber ?? '—', mono: true },
    { label: t('detail.zonePanel.manufacturer', { defaultValue: '제조사' }), value: part.manufacturer ?? '—' },
  ];

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={onBack}
        className={cn('flex w-fit cursor-pointer items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground', FOCUS_RING)}
      >
        <ChevronLeft className="size-3.5" />
        {t('detail.zonePanel.back', { defaultValue: '목록으로' })}
      </button>

      <div className="rounded-lg border border-border/80 bg-card/60 p-4">
        <div className="mb-3 flex items-start justify-between gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t('detail.zonePanel.partSpec', { defaultValue: '부품 재원' })}
          </span>
          <Badge variant={COMPONENT_STATUS_VARIANT[part.status]}>
            {t(`detail.component.status.${part.status}`)}
          </Badge>
        </div>

        <dl className="space-y-2.5">
          {rows.map(({ label, value, mono }) => (
            <div key={label}>
              <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {label}
              </dt>
              <dd className={cn('mt-0.5 text-sm font-medium break-all', mono && 'font-mono text-xs')}>
                {value}
              </dd>
            </div>
          ))}

          {/* 잔여 수명 게이지 */}
          <div>
            <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {t('detail.zonePanel.remainingLife', { defaultValue: '잔여 수명' })}
            </dt>
            <dd className="mt-1.5 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn('h-full rounded-full', TONE_DOT[tone])}
                  style={{ width: `${remainingPct}%` }}
                />
              </div>
              <span className={cn('shrink-0 text-sm font-semibold tabular-nums', TONE_TEXT[tone])}>
                {remainingPct}%
              </span>
            </dd>
            <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">
              {part.currentHours.toLocaleString()}h / {part.expectedLifeHours.toLocaleString()}h
            </p>
          </div>
        </dl>
      </div>
    </div>
  );
}

/** 접이식 클러스터 블록 + 컴팩트 부품 행 */
function ClusterGroup({
  group,
  onSelectPart,
}: {
  group: ZoneClusterGroup;
  onSelectPart: (componentId: string) => void;
}) {
  const { t } = useTranslation('asset-management');
  const [open, setOpen] = useState(false);
  const worstUsedPct = group.parts.reduce((max, c) => Math.max(max, usedPercent(c)), 0);

  return (
    <div className={cn(SURFACE_PANEL, 'overflow-hidden')}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn('flex w-full cursor-pointer items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-muted/40', FOCUS_RING)}
      >
        <ChevronDown
          className={cn(
            'size-3.5 shrink-0 text-muted-foreground transition-transform',
            !open && '-rotate-90',
          )}
        />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">
          {group.cluster.componentName}
        </span>
        {worstUsedPct >= 70 && (
          <span
            className={cn(
              'shrink-0 text-[11px] font-semibold tabular-nums',
              worstUsedPct >= 90 ? TONE_TEXT.critical : TONE_TEXT.warning,
            )}
          >
            {worstUsedPct}%
          </span>
        )}
        <Badge variant={COMPONENT_STATUS_VARIANT[group.cluster.status]} className="shrink-0">
          {t(`detail.component.status.${group.cluster.status}`)}
        </Badge>
        <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
          {t('detail.component.partsCount', { n: group.parts.length })}
        </span>
      </button>
      {open && group.parts.length > 0 && (
        <div className="divide-y divide-border/40 border-t border-border/60 px-1.5 py-1">
          {group.parts.map((part) => {
            const usedPct = usedPercent(part);
            const tone = lifeTone(usedPct);
            return (
              <button
                key={part.id}
                type="button"
                onClick={() => onSelectPart(part.id)}
                className={cn('flex w-full cursor-pointer items-center gap-2.5 rounded px-2.5 py-2 text-left transition-colors hover:bg-muted/40', FOCUS_RING)}
              >
                <StatusDot status={COMPONENT_STATUS_DOT[part.status]} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{part.componentName}</p>
                  {part.partNumber && (
                    <p className="truncate font-mono text-[10px] text-muted-foreground">
                      {part.partNumber}
                    </p>
                  )}
                </div>
                <div className="flex w-20 shrink-0 items-center gap-1.5">
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn('h-full rounded-full', TONE_DOT[tone])}
                      style={{ width: `${usedPct}%` }}
                    />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** 자산 상세 3D 탭 우측 패널 — 구역 → 클러스터 → 부품 재원 */
export function ZoneSpecPanel({
  zoneKeys,
  selectedZoneKey,
  hoveredZoneKey,
  onZoneHover,
  onZoneSelect,
  clusterGroups,
  selectedPart,
  onSelectPart,
  hasBomData,
  className,
}: ZoneSpecPanelProps) {
  const { t } = useTranslation('asset-management');

  return (
    <aside
      className={cn(
        'flex flex-col gap-3 overflow-y-auto rounded-lg border border-border/80 bg-card/40 p-4',
        className,
      )}
    >
      {/* 존 칩: 3D와 양방향 hover 연동 — 비 3D 사용자도 칩으로 선택 가능 */}
      <div className="flex flex-wrap gap-1.5">
        {zoneKeys.map((key) => {
          const isActive = selectedZoneKey === key;
          const isHovered = hoveredZoneKey === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onZoneSelect(isActive ? null : key)}
              onMouseEnter={() => onZoneHover(key)}
              onMouseLeave={() => onZoneHover(null)}
              className={cn(FOCUS_RING, 
                'inline-flex cursor-pointer items-center gap-1.5 rounded px-2.5 py-1 text-[11px] font-medium transition-all',
                isActive
                  ? TONE_PILL_ACTIVE.info
                  : isHovered
                    ? 'bg-muted text-foreground'
                    : PILL_INACTIVE,
              )}
            >
              {t(`detail.zones.${key}`, { defaultValue: key })}
            </button>
          );
        })}
        {selectedZoneKey && (
          <button
            type="button"
            onClick={() => onZoneSelect(null)}
            className={cn('inline-flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground', FOCUS_RING)}
          >
            <X className="size-3" />
            {t('detail.zonePanel.allZones', { defaultValue: '전체 보기' })}
          </button>
        )}
      </div>

      <div className="h-px bg-border/60" />

      {!hasBomData ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {t('detail.noBomData')}
        </p>
      ) : selectedPart ? (
        <PartSpecCard part={selectedPart} onBack={() => onSelectPart(null)} />
      ) : !selectedZoneKey ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <MousePointerClick className="size-6 text-muted-foreground/50" />
          <p className="max-w-56 text-xs leading-relaxed text-muted-foreground">
            {t('detail.zonePanel.hint', {
              defaultValue: '3D 모델에서 구역을 클릭하면 해당 부품 재원이 표시됩니다.',
            })}
          </p>
        </div>
      ) : clusterGroups.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {t('detail.noMatch', { defaultValue: 'No components match.' })}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t(`detail.zones.${selectedZoneKey}`, { defaultValue: selectedZoneKey })}
            <span className="ml-1.5 font-normal normal-case tabular-nums">
              {t('detail.component.partsCount', {
                n: clusterGroups.reduce((n, g) => n + g.parts.length, 0),
              })}
            </span>
          </p>
          {clusterGroups.map((group) => (
            <ClusterGroup
              key={group.cluster.id}
              group={group}
              onSelectPart={onSelectPart}
            />
          ))}
        </div>
      )}
    </aside>
  );
}
