import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Box, CalendarClock, ChevronRight, Wrench } from 'lucide-react';
import type { AssetComponentStats, AssetHealthSnapshot } from '@crane/features/asset';
import type { CraneAsset, CraneType } from '@crane/domain/asset';
import { Badge } from '@crane/ui/atoms/badge';
import { StatusDot } from '@crane/ui/atoms/status-dot';
import { cn } from '@crane/core/lib/utils';
import { SURFACE_PANEL } from '../../../shared/ui/surface';
import { TONE_DOT, TONE_TEXT, type Tone } from '../../../shared/ui/tone';
import {
  ASSET_STATUS_DOT as STATUS_DOT,
  ASSET_STATUS_VARIANT as STATUS_TONE,
} from '../../../shared/ui/status-variants';
import { daysBetween, parseLocalDate } from '../../../shared/lib/relative-date';

// 비정상 구성품 상태 → 톤 (심각도 높은 순으로 표시)
const ISSUE_TONES: { key: keyof AssetComponentStats; tone: Tone }[] = [
  { key: 'replace', tone: 'critical' },
  { key: 'critical', tone: 'critical' },
  { key: 'warning', tone: 'warning' },
  { key: 'caution', tone: 'warning' },
];

function formatRelativeDays(
  iso: string | undefined,
  today: Date,
  t: (k: string, opts?: Record<string, unknown>) => string,
): string {
  if (!iso) return t('card.noActivity', { defaultValue: 'No activity' });
  const days = daysBetween(today, parseLocalDate(iso));
  if (days <= 0) return t('card.today', { defaultValue: 'Today' });
  if (days === 1) return t('card.yesterday', { defaultValue: 'Yesterday' });
  if (days < 30) return t('card.daysAgo', { count: days, defaultValue: `${days}d ago` });
  const months = Math.floor(days / 30);
  return t('card.monthsAgo', { count: months, defaultValue: `${months}mo ago` });
}

function StatTile({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-border/60 bg-muted/30 px-3 py-2.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}

export function AssetSummaryCard({
  asset,
  today,
  overdueInspections = 0,
  activeRepairs = 0,
  health,
  componentStats,
  lastActivity,
  nextInspection,
}: {
  asset: CraneAsset;
  today: Date;
  overdueInspections?: number;
  activeRepairs?: number;
  health?: AssetHealthSnapshot;
  componentStats?: AssetComponentStats;
  lastActivity?: string;
  nextInspection?: string;
}) {
  const { t } = useTranslation('asset-management');

  const daysLeft = daysBetween(parseLocalDate(asset.warrantyEnd), today);
  const warrantyExpired = daysLeft < 0;
  const warrantySoon = daysLeft >= 0 && daysLeft <= 180;

  const openWo = overdueInspections + activeRepairs;
  const issues = componentStats?.issues ?? 0;
  const healthPct = health?.remainingPct ?? 100;
  const healthTone: Tone =
    healthPct <= 20 ? 'critical' : healthPct <= 50 ? 'warning' : 'positive';

  const nextInspDays = nextInspection ? daysBetween(parseLocalDate(nextInspection), today) : null;
  const nextInspOverdue = nextInspDays !== null && nextInspDays < 0;

  return (
    <div
      className={cn(
        SURFACE_PANEL,
        'group relative flex cursor-pointer flex-col gap-4 p-5 shadow-sm transition-all hover:border-border hover:shadow-md',
      )}
    >
      {/* 카드 전체를 덮는 상세 이동 링크 (stretched link) */}
      <Link
        to={`/asset-management/${asset.id}`}
        aria-label={asset.name}
        className="absolute inset-0 z-0 rounded-lg"
      />

      {/* 상단: 아이덴티티 + 보증/이동 (링크 위, 클릭은 링크로 통과) */}
      <div className="pointer-events-none relative z-[1] flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1.5">
          <div className="flex items-center gap-2">
            <StatusDot status={STATUS_DOT[asset.status]} />
            <h3 className="truncate text-base font-bold">{asset.name}</h3>
            <Badge variant={STATUS_TONE[asset.status]} className="shrink-0">
              {t(`status.${asset.status}`)}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {t(`craneType.${asset.craneType as CraneType}`)} · {asset.capacityTon}
            {t('units.ton')} · {asset.manufacturer}
            <span className="mx-1.5 text-border">|</span>
            {asset.locationZone}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            to={`/asset-management/${asset.id}?tab=3d`}
            aria-label={t('card.view3d', { defaultValue: 'View 3D' })}
            title={t('card.view3d', { defaultValue: 'View 3D' })}
            className="pointer-events-auto z-[2] inline-flex cursor-pointer items-center gap-1 rounded-md border border-border bg-card/80 px-2 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
          >
            <Box className="size-3.5" />
            3D
          </Link>
          <Badge
            variant={warrantyExpired ? 'destructive' : warrantySoon ? 'warning' : 'secondary'}
          >
            {warrantyExpired
              ? t('card.warrantyExpired')
              : t('card.warrantyUntil', { date: asset.warrantyEnd })}
          </Badge>
          <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
        </div>
      </div>

      {/* 하단: 운영 지표 타일 */}
      <div className="pointer-events-none relative z-[1] grid grid-cols-2 gap-2.5 md:grid-cols-4">
        {/* 구성품 건강도 */}
        <StatTile label={t('card.health', { defaultValue: 'Component Health' })}>
          <div className="flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div className={cn('h-full rounded-full', TONE_DOT[healthTone])} style={{ width: `${healthPct}%` }} />
            </div>
            <span className={cn('shrink-0 text-sm font-semibold tabular-nums', TONE_TEXT[healthTone])}>
              {healthPct}%
            </span>
          </div>
          <span className="truncate text-[11px] text-muted-foreground">
            {health
              ? `${t('card.worst', { defaultValue: 'Worst' })}: ${health.componentName}`
              : t('card.noData', { defaultValue: 'No data' })}
          </span>
        </StatTile>

        {/* 구성품 상태 카운트 */}
        <StatTile label={t('card.components', { defaultValue: 'Components' })}>
          {issues > 0 ? (
            <>
              <span className="text-sm font-semibold tabular-nums text-foreground">
                {t('card.issueCount', { count: issues, defaultValue: `${issues} issues` })}
              </span>
              <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
                {ISSUE_TONES.map(({ key, tone }) => {
                  const n = (componentStats?.[key] ?? 0) as number;
                  if (n === 0) return null;
                  return (
                    <span key={key} className={cn('flex items-center gap-1', TONE_TEXT[tone])}>
                      <span className={cn('size-1.5 rounded-full', TONE_DOT[tone])} />
                      {t(`detail.componentHealth.${key}`)} {n}
                    </span>
                  );
                })}
              </span>
            </>
          ) : (
            <>
              <span className={cn('text-sm font-semibold tabular-nums', TONE_TEXT.positive)}>
                {t('card.allNormal', { defaultValue: 'All Normal' })}
              </span>
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {t('card.totalParts', { count: componentStats?.total ?? 0, defaultValue: `${componentStats?.total ?? 0} parts` })}
              </span>
            </>
          )}
        </StatTile>

        {/* 미결 WO */}
        <StatTile label={t('card.openWo', { defaultValue: 'Open WO' })}>
          <span
            className={cn(
              'flex items-center gap-1.5 text-sm font-semibold tabular-nums',
              openWo > 0 ? TONE_TEXT.warning : 'text-foreground',
            )}
          >
            <Wrench className="size-3.5" />
            {openWo}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {openWo > 0
              ? t('card.woBreakdown', {
                  overdue: overdueInspections,
                  repair: activeRepairs,
                  defaultValue: `${overdueInspections} insp · ${activeRepairs} repair`,
                })
              : t('card.noOpenWo', { defaultValue: 'None open' })}
          </span>
        </StatTile>

        {/* 다음 점검 — 기한이 지났으면 "다음"이 아니라 "지연"으로 정직하게 라벨링 */}
        <StatTile
          label={
            nextInspOverdue
              ? t('card.inspectionOverdue', { defaultValue: 'Inspection Overdue' })
              : t('card.nextInspection', { defaultValue: 'Next Inspection' })
          }
        >
          {nextInspection ? (
            <>
              <span
                className={cn(
                  'flex items-center gap-1.5 text-sm font-semibold tabular-nums',
                  nextInspOverdue ? TONE_TEXT.critical : 'text-foreground',
                )}
              >
                <CalendarClock className="size-3.5" />
                {nextInspOverdue
                  ? `D+${Math.abs(nextInspDays!)}`
                  : nextInspDays === 0
                    ? 'D-Day'
                    : `D-${nextInspDays}`}
              </span>
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {nextInspection}
              </span>
            </>
          ) : (
            <>
              <span className="text-sm font-semibold text-muted-foreground">—</span>
              <span className="text-[11px] text-muted-foreground">
                {t('card.lastActivity', { defaultValue: 'Last' })}:{' '}
                {formatRelativeDays(lastActivity, today, t)}
              </span>
            </>
          )}
        </StatTile>
      </div>
    </div>
  );
}
