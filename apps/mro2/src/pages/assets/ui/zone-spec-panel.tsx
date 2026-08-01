import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronLeft, MousePointerClick, X } from 'lucide-react';
import type { CraneComponent } from '@crane/domain/asset';
import { KC, KC_FONT_MONO } from '../../../shared/ui/kc';
import {
  COMPONENT_STATUS_COLOR,
  lifeColor,
  remainingPct,
  usedPct,
} from '../../../shared/lib/component';

export interface ZoneClusterGroup {
  cluster: CraneComponent;
  parts: CraneComponent[];
}

interface ZoneSpecPanelProps {
  zoneKeys: string[];
  selectedZoneKey: string | null;
  hoveredZoneKey: string | null;
  onZoneHover: (key: string | null) => void;
  onZoneSelect: (key: string | null) => void;
  clusterGroups: ZoneClusterGroup[];
  selectedPart: CraneComponent | null;
  onSelectPart: (componentId: string | null) => void;
  hasBomData: boolean;
  className?: string;
}

/** 상태 배지 */
function StatusBadge({ status }: { status: CraneComponent['status'] }) {
  const { t } = useTranslation('asset-management');
  const color = COMPONENT_STATUS_COLOR[status];
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-[3px] px-1.5 py-0.5 text-[10px] font-semibold"
      style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {t(`detail.component.status.${status}`)}
    </span>
  );
}

/** 잔여 수명 바 */
function LifeBar({ part, thin = false }: { part: CraneComponent; thin?: boolean }) {
  const remaining = remainingPct(part);
  const color = lifeColor(usedPct(part));
  return (
    <span
      className="block w-full overflow-hidden rounded-full"
      style={{ height: thin ? 4 : 6, background: KC.track }}
    >
      <span className="block h-full rounded-full" style={{ width: `${remaining}%`, background: color }} />
    </span>
  );
}

/** 부품 재원 카드 */
function PartSpecCard({ part, onBack }: { part: CraneComponent; onBack: () => void }) {
  const { t } = useTranslation('asset-management');
  const remaining = remainingPct(part);
  const color = lifeColor(usedPct(part));

  const rows = [
    { label: t('detail.zonePanel.partName'), value: part.componentName },
    { label: t('detail.zonePanel.partNumber'), value: part.partNumber ?? '—', mono: true },
    { label: t('detail.zonePanel.manufacturer'), value: part.manufacturer ?? '—' },
  ];

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={onBack}
        className="flex w-fit cursor-pointer items-center gap-1 text-[11px]"
        style={{ color: KC.muted }}
      >
        <ChevronLeft size={13} />
        {t('detail.zonePanel.back')}
      </button>

      <div className="rounded-[4px] border p-4" style={{ borderColor: KC.hairline, background: KC.bgSubtle }}>
        <div className="mb-3 flex items-start justify-between gap-2">
          <span className="text-[10px] font-semibold tracking-wider uppercase" style={{ color: KC.muted }}>
            {t('detail.zonePanel.partSpec')}
          </span>
          <StatusBadge status={part.status} />
        </div>

        <dl className="flex flex-col gap-2.5">
          {rows.map(({ label, value, mono }) => (
            <div key={label}>
              <dt className="text-[10px] tracking-wider uppercase" style={{ color: KC.muted }}>
                {label}
              </dt>
              <dd
                className="mt-0.5 text-[13px] font-medium break-all"
                style={{ color: KC.ink, fontFamily: mono ? KC_FONT_MONO : undefined }}
              >
                {value}
              </dd>
            </div>
          ))}

          <div>
            <dt className="text-[10px] tracking-wider uppercase" style={{ color: KC.muted }}>
              {t('detail.zonePanel.remainingLife')}
            </dt>
            <dd className="mt-1.5 flex items-center gap-2">
              <div className="flex-1">
                <LifeBar part={part} />
              </div>
              <span className="shrink-0 text-[13px] font-semibold tabular-nums" style={{ color }}>
                {remaining}%
              </span>
            </dd>
            <p className="mt-1 text-[11px] tabular-nums" style={{ color: KC.muted }}>
              {part.currentHours.toLocaleString()}h / {part.expectedLifeHours.toLocaleString()}h
            </p>
          </div>
        </dl>
      </div>
    </div>
  );
}

/** 접이식 클러스터 블록 */
function ClusterGroup({
  group,
  onSelectPart,
}: {
  group: ZoneClusterGroup;
  onSelectPart: (componentId: string) => void;
}) {
  const { t } = useTranslation('asset-management');
  const [open, setOpen] = useState(false);
  const worstUsed = group.parts.reduce((max, c) => Math.max(max, usedPct(c)), 0);

  return (
    <div className="overflow-hidden rounded-[4px] border" style={{ borderColor: KC.hairline }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="kc-hover flex w-full cursor-pointer items-center gap-2.5 px-3 py-2.5 text-left"
      >
        <ChevronDown
          size={13}
          className="shrink-0 transition-transform"
          style={{ color: KC.muted, transform: open ? undefined : 'rotate(-90deg)' }}
        />
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold" style={{ color: KC.ink }}>
          {group.cluster.componentName}
        </span>
        {worstUsed >= 70 && (
          <span
            className="shrink-0 text-[11px] font-semibold tabular-nums"
            style={{ color: worstUsed >= 90 ? KC.safety : KC.production }}
          >
            {worstUsed}%
          </span>
        )}
        <StatusBadge status={group.cluster.status} />
        <span className="shrink-0 text-[11px] tabular-nums" style={{ color: KC.muted }}>
          {t('detail.component.partsCount', { n: group.parts.length })}
        </span>
      </button>
      {open && group.parts.length > 0 && (
        <div className="border-t px-1.5 py-1" style={{ borderColor: KC.hairline }}>
          {group.parts.map((part) => (
            <button
              key={part.id}
              type="button"
              onClick={() => onSelectPart(part.id)}
              className="kc-hover flex w-full cursor-pointer items-center gap-2.5 rounded-[3px] px-2.5 py-2 text-left"
            >
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ background: COMPONENT_STATUS_COLOR[part.status] }}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-medium" style={{ color: KC.ink }}>
                  {part.componentName}
                </p>
                {part.partNumber && (
                  <p className="truncate text-[10px]" style={{ color: KC.muted, fontFamily: KC_FONT_MONO }}>
                    {part.partNumber}
                  </p>
                )}
              </div>
              <div className="w-20 shrink-0">
                <LifeBar part={part} thin />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** 3D 탭 우측 패널 — 구역 → 클러스터 → 부품 재원 */
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
      className={`flex flex-col gap-3 overflow-y-auto rounded-[4px] border p-4 ${className ?? ''}`}
      style={{ borderColor: KC.border, background: KC.bgSubtle }}
    >
      {/* 존 칩 — 3D와 양방향 hover 연동 */}
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
              className="cursor-pointer rounded-[3px] px-2.5 py-1 text-[11px] font-medium transition-colors"
              style={{
                background: isActive ? KC.improvement : isHovered ? KC.bgRow : KC.bg,
                color: isActive ? '#fff' : KC.text,
                border: `1px solid ${isActive ? KC.improvement : KC.border}`,
              }}
            >
              {t(`detail.zones.${key}`, { defaultValue: key })}
            </button>
          );
        })}
        {selectedZoneKey && (
          <button
            type="button"
            onClick={() => onZoneSelect(null)}
            className="inline-flex cursor-pointer items-center gap-1 rounded-[3px] px-2 py-1 text-[11px]"
            style={{ color: KC.muted }}
          >
            <X size={12} />
            {t('detail.zonePanel.allZones')}
          </button>
        )}
      </div>

      <div className="h-px" style={{ background: KC.hairline }} />

      {!hasBomData ? (
        <p className="py-10 text-center text-[13px]" style={{ color: KC.muted }}>
          {t('detail.noBomData')}
        </p>
      ) : selectedPart ? (
        <PartSpecCard part={selectedPart} onBack={() => onSelectPart(null)} />
      ) : !selectedZoneKey ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <MousePointerClick size={24} style={{ color: KC.faint }} />
          <p className="max-w-56 text-[12px] leading-relaxed" style={{ color: KC.muted }}>
            {t('detail.zonePanel.hint')}
          </p>
        </div>
      ) : clusterGroups.length === 0 ? (
        <p className="py-10 text-center text-[13px]" style={{ color: KC.muted }}>
          {t('detail.noMatch')}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-semibold tracking-wider uppercase" style={{ color: KC.muted }}>
            {t(`detail.zones.${selectedZoneKey}`, { defaultValue: selectedZoneKey })}
            <span className="ml-1.5 font-normal normal-case tabular-nums">
              {t('detail.component.partsCount', {
                n: clusterGroups.reduce((n, g) => n + g.parts.length, 0),
              })}
            </span>
          </p>
          {clusterGroups.map((group) => (
            <ClusterGroup key={group.cluster.id} group={group} onSelectPart={onSelectPart} />
          ))}
        </div>
      )}
    </aside>
  );
}
