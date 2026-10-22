import { ChevronUp, Crosshair, Triangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Alarm } from '@crane/domain/alarm';
import { useNow } from '@crane/core/lib/use-now';
import { cn } from '@crane/core/lib/utils';
import { Button } from '@crane/ui/atoms/button';
import { ScrollArea } from '@crane/ui/molecules/scroll-area';
import {
  resolveHudElapsed,
  type HudCondition,
  type HudConditionRow,
  type HudConditionSummary,
} from '../lib/hud-conditions';

/**
 * 관제 HUD 의 알람 목록 — HUD 알람 요약 버튼으로 펼치는 패널. 실시간 화면의
 * 알람 목록은 이것 하나다(우상단 알람 패널·독 벨 토글·critical 배너는 두지
 * 않는다 — 같은 사건이 세 군데 뜨면 겹친다).
 *
 * 행은 크레인마다 하나(lib/hud-conditions.ts) — 제목은 가장 심각한 조건,
 * 상세 줄은 그 조건의 부연과 나머지 조건들이다. 경과는 제목 조건이 생긴
 * 뒤 흐른 시간이고 1초 틱으로 다시 그린다. [보기]는 영역 행이면 그 영역,
 * 그 외는 그 크레인으로 카메라를 보낸다(뷰가 `onViewRow` 로 잇는다). 씬에
 * 없는 크레인의 알람 행은 보낼 곳이 없어 버튼이 없다.
 */

type Translate = ReturnType<typeof useTranslation>['t'];

interface SceneStatusHudAlarmListProps {
  id: string;
  conditions: HudConditionSummary;
  onCollapse: () => void;
  onViewRow?: (row: HudConditionRow) => void;
}

export function SceneStatusHudAlarmList({
  id,
  conditions,
  onCollapse,
  onViewRow,
}: SceneStatusHudAlarmListProps) {
  const { t } = useTranslation();
  const now = useNow(1_000);
  const title = t('monitoring:hud.list.title', {
    count: conditions.rows.length,
  });
  return (
    <section
      id={id}
      aria-label={title}
      className="pointer-events-auto w-150 overflow-hidden rounded border border-white/10 bg-[#111113]/92 whitespace-nowrap shadow-lg backdrop-blur-md"
    >
      <div className="flex h-10 items-center gap-2 border-b border-white/9 pr-1.5 pl-3.5">
        <b className="text-sm font-bold">{title}</b>
        <span className="text-[11px] text-neutral-500">
          {t('monitoring:hud.list.scope')}
        </span>
        <span className="ml-auto text-[11px] text-neutral-500">
          {t('monitoring:hud.list.order')}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-neutral-400 hover:bg-white/10 hover:text-neutral-50"
          aria-label={t('monitoring:hud.collapseAlarms')}
          onClick={onCollapse}
        >
          <ChevronUp />
        </Button>
      </div>
      <ScrollArea className="max-h-[60vh]">
        <ul className="flex flex-col gap-1 p-2">
          {conditions.rows.map((row) => (
            <AlarmRow key={row.key} row={row} now={now} onView={onViewRow} />
          ))}
        </ul>
      </ScrollArea>
    </section>
  );
}

function AlarmRow({
  row,
  now,
  onView,
}: {
  row: HudConditionRow;
  now: number;
  onView?: (row: HudConditionRow) => void;
}) {
  const { t } = useTranslation();
  const danger = row.level === 'danger';
  const primary = describeCondition(row.primary, t);
  const details = [
    primary.detail,
    ...row.others.map((condition) => {
      const described = describeCondition(condition, t);
      return described.detail
        ? `${described.label} · ${described.detail}`
        : described.label;
    }),
  ].filter((text): text is string => Boolean(text));
  const detailText = details.join(' · ');
  const elapsed = resolveHudElapsed(row.primary.since, now);
  const elapsedText = elapsed
    ? t(`monitoring:hud.elapsed.${elapsed.unit}`, { count: elapsed.value })
    : null;
  const viewLabel =
    row.primary.kind === 'zone'
      ? t('monitoring:hud.list.viewZone')
      : t('monitoring:hud.list.view', { name: row.name });
  const canView =
    onView !== undefined &&
    (row.primary.kind === 'zone' || row.modelId !== null);
  return (
    <li
      className={cn(
        'flex min-h-8.5 items-center gap-2 rounded py-1 pr-1.5 pl-2.5',
        danger && 'bg-red-500/13',
      )}
    >
      {danger ? (
        <Triangle
          className="size-2.5 shrink-0 fill-red-400 text-red-400"
          aria-hidden
        />
      ) : (
        <span
          aria-hidden
          className="mx-px size-2 shrink-0 rounded-full bg-amber-400"
        />
      )}
      <b
        className="w-14 shrink-0 truncate text-[13px] font-bold"
        title={row.name}
      >
        {row.name}
      </b>
      <span className="flex min-w-0 flex-col gap-0.75">
        <span
          className={cn(
            'text-[13px] leading-tight font-semibold',
            danger ? 'text-red-400' : 'text-amber-400',
          )}
        >
          {primary.label}
        </span>
        {detailText ? (
          <span
            className="truncate text-xs leading-tight text-neutral-300"
            title={detailText}
          >
            {detailText}
          </span>
        ) : null}
      </span>
      <span className="ml-auto shrink-0 text-[11px] text-neutral-400">
        {elapsedText}
      </span>
      {canView ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="shrink-0 text-neutral-400 hover:bg-white/10 hover:text-neutral-50"
          aria-label={viewLabel}
          title={viewLabel}
          onClick={() => onView(row)}
        >
          <Crosshair />
        </Button>
      ) : null}
    </li>
  );
}

function alarmTitle(alarm: Alarm): string {
  return alarm.alarmName ?? alarm.rawTagCode ?? alarm.eventType;
}

/** 조건 하나의 제목과 부연 — 문구는 전부 i18n 키(monitoring:hud.row.*). */
function describeCondition(
  condition: HudCondition,
  t: Translate,
): { label: string; detail: string | null } {
  switch (condition.kind) {
    case 'collision':
      return {
        label: t('monitoring:hud.row.collision'),
        detail: t('monitoring:hud.row.collisionDetail', {
          other: condition.otherName,
        }),
      };
    case 'zone':
      return {
        label: t('monitoring:hud.row.zone'),
        detail: [
          t('monitoring:hud.row.zoneDetail', {
            owner: condition.ownerName,
            zone: condition.zoneName,
          }),
          condition.held ? t('monitoring:hud.row.held') : null,
        ]
          .filter(Boolean)
          .join(' · '),
      };
    case 'fault':
      return { label: t('monitoring:hud.row.fault'), detail: null };
    case 'offline':
      return { label: t('monitoring:hud.row.offline'), detail: null };
    case 'bypass':
      return { label: t('monitoring:hud.row.bypass'), detail: null };
    case 'alarm':
      return {
        label: t(
          condition.level === 'danger'
            ? 'monitoring:hud.row.alarmDanger'
            : 'monitoring:hud.row.alarmCaution',
          { count: condition.alarms.length },
        ),
        detail: condition.alarms.map(alarmTitle).join(' · '),
      };
  }
}
