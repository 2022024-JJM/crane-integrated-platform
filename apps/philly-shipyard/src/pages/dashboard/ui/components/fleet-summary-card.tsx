import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Layers, ArrowUpRight } from 'lucide-react';
import type { AssetStatus } from '@crane/domain/asset';
import { cn } from '@crane/core/lib/utils';
import { SectionCard } from './section-card';
import { TONE_DOT, TONE_TEXT } from '../../../../shared/ui/tone';
import { ASSET_STATUS_TONE } from '../../../../shared/ui/status-variants';
import { FOCUS_RING } from '../../../../shared/ui/controls';
import type { DailyPassFail } from '../../model/aggregations';

interface FleetSummaryCardProps {
  cranes: { id: string; name: string; status: AssetStatus }[];
  /** 최근 7일 일자별 점검 결과 (과거→오늘) */
  byDay: DailyPassFail[];
  /** 기한 초과 점검 건수 — 최근 결과가 없을 때 안내 링크에 사용 */
  overdueCount: number;
}

/**
 * 자산·점검 현황 — 조선소의 실물(크레인)이 상태와 함께 그대로 등장한다.
 * %게이지·0/0 도넛 대신 크레인 행 + 최근 7일 미니 바로 "무엇이, 어떤 상태로, 최근 어땠는지"를 답한다.
 */
export function FleetSummaryCard({ cranes, byDay, overdueCount }: FleetSummaryCardProps) {
  const { t } = useTranslation('philly-dashboard');
  const passed = byDay.reduce((s, d) => s + d.passed, 0);
  const failed = byDay.reduce((s, d) => s + d.failed, 0);
  const recentTotal = passed + failed;
  const maxDay = Math.max(1, ...byDay.map((d) => d.passed + d.failed));

  return (
    <SectionCard
      title={t('fleetSummary.title', { defaultValue: 'Assets & Inspections' })}
      icon={Layers}
      accent="success"
      href="/asset-management"
    >
      {/* 크레인 행 — 이름·상태 도트·상태 라벨, 클릭 시 자산 상세 */}
      <div className="flex flex-col gap-2">
        {cranes.map((crane) => {
          const tone = ASSET_STATUS_TONE[crane.status];
          return (
            <Link
              key={crane.id}
              to={`/asset-management/${crane.id}`}
              className={cn(
                'group flex items-center gap-2.5 rounded-lg border border-border/60 bg-muted/20 px-3 py-2 transition-colors hover:bg-muted/40',
                FOCUS_RING,
              )}
            >
              <span className={cn('size-2 shrink-0 rounded-full', TONE_DOT[tone])} />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                {crane.name}
              </span>
              <span className={cn('shrink-0 text-[11px] font-semibold', TONE_TEXT[tone])}>
                {t(`status.${crane.status}`, { ns: 'asset-management' })}
              </span>
              <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground/40 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary motion-reduce:transition-none" />
            </Link>
          );
        })}
      </div>

      {/* 최근 7일 점검 미니 바 — 하루 = 한 칸, 결과 없는 날은 낮은 스텁으로 리듬만 남긴다 */}
      <div className="mt-4 border-t border-border/60 pt-3">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {t('fleetSummary.recent7', { defaultValue: 'Inspections, last 7 days' })}
          </p>
          {recentTotal > 0 && (
            <p className="flex items-center gap-3 text-xs tabular-nums text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className={cn('size-1.5 rounded-full', TONE_DOT.positive)} />
                {t('dailyInspection.passed')} {passed}
              </span>
              <span className="flex items-center gap-1">
                <span className={cn('size-1.5 rounded-full', TONE_DOT.critical)} />
                {t('dailyInspection.failed')} {failed}
              </span>
            </p>
          )}
        </div>

        <div className="mt-2 flex h-10 items-end gap-1" role="img" aria-label={t('fleetSummary.recent7')}>
          {byDay.map((day) => {
            const total = day.passed + day.failed;
            return (
              <div
                key={day.date}
                title={`${day.date} · ${t('dailyInspection.passed')} ${day.passed} · ${t('dailyInspection.failed')} ${day.failed}`}
                className="flex h-full flex-1 flex-col justify-end gap-px"
              >
                {total === 0 ? (
                  <div className="h-[3px] rounded-sm bg-muted" />
                ) : (
                  <>
                    {day.failed > 0 && (
                      <div
                        className={cn('rounded-sm', TONE_DOT.critical)}
                        style={{ height: `${(day.failed / maxDay) * 100}%` }}
                      />
                    )}
                    {day.passed > 0 && (
                      <div
                        className={cn('rounded-sm', TONE_DOT.positive)}
                        style={{ height: `${(day.passed / maxDay) * 100}%` }}
                      />
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>

        {recentTotal === 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="text-muted-foreground">
              {t('fleetSummary.noRecent', {
                defaultValue: 'No inspections completed in the last 7 days',
              })}
            </span>
            <Link
              to={overdueCount > 0 ? '/inspection?status=overdue' : '/inspection'}
              className={cn(
                'group inline-flex items-center gap-1 rounded font-medium text-primary hover:underline',
                FOCUS_RING,
              )}
            >
              {overdueCount > 0
                ? t('fleetSummary.viewOverdue', {
                    count: overdueCount,
                    defaultValue: 'View {{count}} overdue',
                  })
                : t('fleetSummary.viewSchedule', { defaultValue: 'View schedule' })}
              <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none" />
            </Link>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
