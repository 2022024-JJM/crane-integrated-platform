import {
  ChevronDown,
  ChevronUp,
  CircleCheck,
  LoaderCircle,
  Wifi,
  WifiOff,
  Wind,
} from 'lucide-react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SavedSceneInfo } from '@crane/domain/3d';
import type { WeatherSnapshot } from '@crane/domain/weather';
import type { EquipmentRuntimeStatus } from '@crane/core/types/status';
import { useNow } from '@crane/core/lib/use-now';
import { cn } from '@crane/core/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@crane/ui/molecules/tooltip';
import {
  formatFeedClock,
  resolveFeedFreshness,
  type FeedFreshnessTone,
} from '../lib/feed-freshness';
import type {
  HudConditionRow,
  HudConditionSummary,
} from '../lib/hud-conditions';
import {
  RUNTIME_STATUS_COLORS,
  countRuntimeStatuses,
  type RuntimeStatusCounts,
  type RuntimeStatusRecord,
} from '../lib/model-runtime-status';
import {
  WIND_CAUTION_MS,
  WIND_STOP_MS,
  compassPoint,
  formatClockHm,
  resolveWindAdvisory,
  windGaugeFraction,
  windGaugeMarks,
} from '../lib/wind-advisory';
import { useCraneFeedConnection } from '../model/use-crane-snapshot-feed';
import { useCraneSnapshotStore } from '../model/use-crane-snapshot-store';
import { useRealtimeStore } from '../model/use-realtime-store';
import { useSceneSunState } from '../model/use-scene-sun-state';
import { useSceneWeather } from '../model/use-scene-weather';
import { SceneStatusHudAlarmList } from './scene-status-hud-alarm-list';
import { CautionGlyph, DangerGlyph } from './scene-status-hud-glyphs';

/**
 * 관제 요약 HUD — 실시간 관제 화면의 3D 캔버스 상단 중앙 한 줄.
 * `[이상 없음 | 경고 n · 주의 m ▾] · 크레인 N대 막대·수치 · 풍속 게이지 · 현장 시각/수신`
 *
 * 값의 출처는 전부 이미 있는 것들이다. 이상 조건은 뷰가 합친 결과
 * (model/use-hud-conditions.ts — 알람 스토어의 알람 + 고장·통신두절·Bypass·
 * 영역 침범·충돌)이고, 크레인 수치는 운전 상태 기록(뷰가 한 번 판정해
 * 넘긴다), 풍속은 현장 좌표의 open-meteo(useSceneWeather), 현장 시각은 씬
 * 시계(useSceneSunState), 수신은 크레인 스냅샷 피드의 소켓·마지막 묶음 시각
 * (lib/feed-freshness.ts)이다.
 *
 * 알람 요약 칸만 버튼이다 — 누르면 HUD 아래로 크레인별 알람 목록이
 * 펼쳐진다(scene-status-hud-alarm-list.tsx). 저절로 펼치지 않고(사용자가
 * 열기 전까지) 조건이 전부 사라지면 접는다. 행의 [보기]로 카메라를 보내면
 * 목록을 닫는다. 버튼·풍속 툴팁 트리거·목록만
 * 포인터를 받고 나머지는 pointer-events-none 이라 아래 캔버스 조작을 막지
 * 않는다. 목록은 스크롤이라 휠을 캔버스로 넘기지 않는다(우상단 고정 뷰 줄과
 * 같은 취급).
 *
 * 색 규칙: 경고 red·주의 amber(글리프는 scene-status-hud-glyphs.tsx). 크레인
 * 막대·점은 운전 상태 색(RUNTIME_STATUS_COLORS — 라벨과 같은 색, 통신두절만
 * 빗금)이고 막대 조각은 여백 없이 잇고 1px 겹쳐 경계의 안티에일리어싱 틈을 가린다. 고장·통신두절 수치는 0 이면 흐리고
 * 1 이상이면 붉게·누렇게 굵어진다. 풍속은 작업 권고 단계(lib/wind-advisory —
 * 주의 amber·중지 red), 수신 줄의 아이콘은 신선도 색조다.
 */

interface SceneStatusHudProps {
  regionId: string;
  runtimeStatuses: RuntimeStatusRecord;
  conditions: HudConditionSummary;
  /** 현장 시각·풍속은 씬 지역(`siteLocation`)을 따른다. */
  sceneInfo?: SavedSceneInfo | null;
  /** 목록 행의 [보기]. 없으면 버튼을 그리지 않는다. */
  onViewRow?: (row: HudConditionRow) => void;
  className?: string;
}

export function SceneStatusHud({
  regionId,
  runtimeStatuses,
  conditions,
  sceneInfo = null,
  onViewRow,
  className,
}: SceneStatusHudProps) {
  const { t } = useTranslation();
  const listId = useId();
  const hasConditions = conditions.rows.length > 0;
  const [expanded, setExpanded] = useState(false);
  // 렌더 중 파생 상태 — 조건이 전부 사라지면 접는다. 새 조건이 생겨도 저절로
  // 펼치지 않는다.
  const [seenAny, setSeenAny] = useState(hasConditions);
  if (seenAny !== hasConditions) {
    setSeenAny(hasConditions);
    if (!hasConditions) setExpanded(false);
  }
  const listOpen = expanded && hasConditions;

  const counts = countRuntimeStatuses(runtimeStatuses);
  const sun = useSceneSunState(regionId, sceneInfo?.siteLocation, 'clock');
  const weather = useSceneWeather(regionId, sceneInfo?.siteLocation);
  const clock = sun?.parts
    ? formatClockHm(sun.parts.hour, sun.parts.minute)
    : null;
  const timeZone = sun?.geo.timeZone ?? null;

  return (
    <div
      data-slot="scene-status-hud"
      className={cn(
        'pointer-events-none absolute top-1.5 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-2 text-neutral-50',
        className,
      )}
    >
      <div
        role="status"
        aria-label={t('monitoring:hud.summary')}
        className="flex h-11 items-center rounded border border-white/10 bg-[#111113]/92 px-1 whitespace-nowrap shadow-lg backdrop-blur-md"
      >
        <AlarmSummaryCell
          conditions={conditions}
          expanded={listOpen}
          listId={listId}
          onToggle={() => setExpanded((open) => !open)}
        />
        <Divider />
        <CraneStatusCell counts={counts} />
        <Divider />
        <WindCell weather={weather} />
        <Divider />
        <div className="flex flex-col gap-1 pr-3 pl-3.5 text-[11px] leading-none text-neutral-400">
          <span className="flex items-center justify-between gap-3">
            <span>{t('monitoring:hud.siteTime')}</span>
            <b className="text-xs font-bold text-neutral-50">
              {clock ?? '--:--'}
            </b>
          </span>
          <FeedLine timeZone={timeZone} />
        </div>
      </div>
      {listOpen ? (
        <SceneStatusHudAlarmList
          id={listId}
          conditions={conditions}
          onCollapse={() => setExpanded(false)}
          onViewRow={
            onViewRow
              ? (row) => {
                  // 카메라가 가는 곳을 목록이 가리지 않게 닫는다.
                  setExpanded(false);
                  onViewRow(row);
                }
              : undefined
          }
        />
      ) : null}
    </div>
  );
}

function Divider() {
  return <span aria-hidden className="h-6 w-px shrink-0 bg-white/12" />;
}

function AlarmSummaryCell({
  conditions,
  expanded,
  listId,
  onToggle,
}: {
  conditions: HudConditionSummary;
  expanded: boolean;
  listId: string;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const { danger, caution } = conditions;
  if (danger === 0 && caution === 0) {
    return (
      <div className="flex h-8 min-w-42 items-center gap-2 pr-3 pl-2.5">
        <CircleCheck className="size-4 shrink-0 text-green-400" aria-hidden />
        <b className="text-box-cap text-sm font-bold text-green-400">
          {t('monitoring:hud.allClear')}
        </b>
      </div>
    );
  }
  return (
    <button
      type="button"
      aria-expanded={expanded}
      aria-controls={listId}
      title={t(
        expanded
          ? 'monitoring:hud.collapseAlarms'
          : 'monitoring:hud.expandAlarms',
      )}
      onClick={onToggle}
      className={cn(
        'pointer-events-auto flex h-8 min-w-42 cursor-pointer items-center gap-2 rounded-sm pr-2 pl-2.5 hover:bg-white/6',
        expanded && 'bg-white/6',
      )}
    >
      {danger > 0 ? (
        <span className="flex items-center gap-1.5">
          <DangerGlyph className="size-3.5" />
          <b className="text-box-cap text-sm font-bold text-red-400">
            {t('monitoring:hud.danger', { count: danger })}
          </b>
        </span>
      ) : null}
      {danger > 0 && caution > 0 ? (
        <span aria-hidden className="size-0.75 rounded-full bg-neutral-400" />
      ) : null}
      {caution > 0 ? (
        <span className="flex items-center gap-1.5">
          <CautionGlyph className="size-3.5" />
          <b className="text-box-cap text-sm font-bold text-amber-400">
            {t('monitoring:hud.caution', { count: caution })}
          </b>
        </span>
      ) : null}
      {expanded ? (
        <ChevronUp className="ml-auto size-3.5 text-neutral-400" aria-hidden />
      ) : (
        <ChevronDown
          className="ml-auto size-3.5 text-neutral-400"
          aria-hidden
        />
      )}
    </button>
  );
}

/** 막대·수치에 올리는 운전 상태 — unknown 은 세지 않는다(title 에만). */
const HUD_STATUSES = [
  'running',
  'standby',
  'off',
  'fault',
  'offline',
] as const satisfies readonly EquipmentRuntimeStatus[];

type HudStatus = (typeof HUD_STATUSES)[number];

/** 막대·점의 채움 — 라벨과 같은 색, 통신두절만 빗금(꺼짐과 같은 회색이라). */
const HUD_STATUS_SWATCH: Record<HudStatus, string> = {
  running: RUNTIME_STATUS_COLORS.running ?? '',
  standby: RUNTIME_STATUS_COLORS.standby ?? '',
  off: RUNTIME_STATUS_COLORS.off ?? '',
  fault: RUNTIME_STATUS_COLORS.fault ?? '',
  offline:
    'repeating-linear-gradient(135deg, #a1a1aa 0 2px, rgba(161,161,170,0.25) 2px 4px)',
};

function CraneStatusCell({ counts }: { counts: RuntimeStatusCounts }) {
  const { t } = useTranslation();
  const total = counts.known;
  const title = [
    t('monitoring:hud.craneCountTitle', { count: total }),
    counts.unknown > 0
      ? t('monitoring:hud.craneUnknown', { count: counts.unknown })
      : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <div className="flex items-center gap-3.5 px-3.5" title={title}>
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] leading-none text-neutral-400">
          {t('monitoring:hud.craneCount', { count: total })}
        </span>
        <div
          className="flex h-1.5 w-26 overflow-hidden rounded-xs bg-white/10 [&>span+span]:-ml-px"
          aria-hidden
        >
          {HUD_STATUSES.map((status) =>
            counts[status] > 0 ? (
              <span
                key={status}
                style={{
                  flex: `${counts[status]} 1 0`,
                  background: HUD_STATUS_SWATCH[status],
                }}
              />
            ) : null,
          )}
        </div>
      </div>
      {HUD_STATUSES.map((status) => (
        <StatusCount key={status} status={status} count={counts[status]} />
      ))}
    </div>
  );
}

function StatusCount({ status, count }: { status: HudStatus; count: number }) {
  const { t } = useTranslation();
  const alerting = status === 'fault' || status === 'offline';
  const dim = alerting && count === 0;
  const hot = alerting && count > 0;
  const title =
    status === 'standby'
      ? `${t('monitoring:runtimeStatus.standby')} — ${t('monitoring:hud.standbyHint')}`
      : t(`monitoring:runtimeStatus.${status}`);
  return (
    <span
      className={cn(
        'flex items-center gap-1.25 text-xs text-neutral-400',
        dim && 'text-neutral-500',
        hot && status === 'fault' && 'font-semibold text-red-300',
        hot && status === 'offline' && 'font-semibold text-amber-200',
      )}
      title={title}
    >
      <span
        aria-hidden
        className={cn('size-1.75 shrink-0 rounded-xs', dim && 'opacity-45')}
        style={{ background: HUD_STATUS_SWATCH[status] }}
      />
      {t(`monitoring:hud.status.${status}`)}
      <b
        className={cn(
          'text-[15px] font-bold text-neutral-50',
          dim && 'font-semibold text-neutral-500',
          hot && status === 'fault' && 'font-extrabold text-red-400',
          hot && status === 'offline' && 'font-extrabold text-amber-400',
        )}
      >
        {count}
      </b>
    </span>
  );
}

function WindCell({ weather }: { weather: WeatherSnapshot | null }) {
  const { t } = useTranslation();
  const speed = weather?.windSpeed ?? null;
  const advisory = resolveWindAdvisory(speed);
  const direction = compassPoint(weather?.windDirection);
  const fraction = windGaugeFraction(speed);
  const marks = windGaugeMarks();
  const reading = fraction !== null && speed !== null ? speed.toFixed(1) : null;
  const tone =
    advisory === 'stop'
      ? 'text-red-400'
      : advisory === 'caution'
        ? 'text-amber-400'
        : null;
  const cautionText = t('monitoring:hud.windCautionTitle', {
    limit: WIND_CAUTION_MS,
  });
  const stopText = t('monitoring:hud.windStopTitle', { limit: WIND_STOP_MS });
  const sourceText = [
    t('monitoring:hud.windSource'),
    advisory === 'stop'
      ? stopText
      : advisory === 'caution'
        ? cautionText
        : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <TooltipProvider delay={150}>
      <div className="flex items-center gap-2.5 px-3.5">
        <Tooltip>
          <TooltipTrigger
            render={
              <span className="pointer-events-auto inline-flex cursor-help" />
            }
          >
            <Wind
              className={cn('size-4 shrink-0 text-neutral-400', tone)}
              aria-hidden
            />
          </TooltipTrigger>
          <TooltipContent side="bottom">{sourceText}</TooltipContent>
        </Tooltip>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline gap-1">
            {reading === null ? (
              <span className="text-xs leading-none text-neutral-500">
                {t('monitoring:hud.windUnavailable')}
              </span>
            ) : (
              <>
                <b className={cn('text-sm leading-none font-bold', tone)}>
                  {reading}
                </b>
                <span className="text-[11px] leading-none text-neutral-400">
                  m/s{direction ? ` · ${direction}` : ''}
                </span>
                {advisory === 'stop' || advisory === 'caution' ? (
                  <span
                    className={cn(
                      'text-[11px] leading-none font-semibold',
                      tone,
                    )}
                  >
                    {t(
                      advisory === 'stop'
                        ? 'monitoring:hud.windStop'
                        : 'monitoring:hud.windCaution',
                    )}
                  </span>
                ) : null}
              </>
            )}
          </div>
          <div className="relative h-1 w-22 rounded-xs bg-white/16">
            {fraction !== null ? (
              <span
                aria-hidden
                className={cn(
                  'absolute top-0 left-0 h-1 rounded-xs bg-white/85',
                  advisory === 'caution' && 'bg-amber-400',
                  advisory === 'stop' && 'bg-red-400',
                )}
                style={{ width: `${fraction * 100}%` }}
              />
            ) : null}
            <GaugeMark
              fraction={marks.caution}
              className="bg-amber-400"
              label={cautionText}
            />
            <GaugeMark
              fraction={marks.stop}
              className="bg-red-400"
              label={stopText}
            />
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

/** 게이지 눈금 — 2px 선은 올리기 어려워 보이지 않는 넓은 영역이 툴팁 트리거다. */
function GaugeMark({
  fraction,
  className,
  label,
}: {
  fraction: number;
  className: string;
  label: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            className="pointer-events-auto absolute -top-1.5 flex h-4 w-2.5 -translate-x-1/2 cursor-help justify-center"
            style={{ left: `${fraction * 100}%` }}
          />
        }
      >
        <span
          aria-hidden
          className={cn('mt-0.75 h-2.5 w-0.5 rounded-[1px]', className)}
        />
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

const FEED_TONE_ICON_CLASS: Record<FeedFreshnessTone, string> = {
  good: 'text-green-400',
  warn: 'text-amber-400',
  bad: 'text-red-400',
  muted: 'text-neutral-500',
};

const FEED_TONE_TEXT_CLASS: Record<FeedFreshnessTone, string | undefined> = {
  good: undefined,
  warn: 'text-amber-300',
  bad: 'text-red-300',
  muted: undefined,
};

/**
 * 수신 줄 — 연결돼 있으면 마지막 묶음의 수신 시각(현장 시간대), 아니면 상태
 * 문구. 1초 틱은 이 줄만 다시 그린다(stale 전환).
 */
function FeedLine({ timeZone }: { timeZone: string | null }) {
  const { t } = useTranslation();
  const now = useNow(1_000);
  const connection = useCraneFeedConnection();
  const held = useRealtimeStore((s) => s.held);
  const lastReceivedAt = useCraneSnapshotStore((s) => s.lastReceivedAt);
  const feed = resolveFeedFreshness(connection, held, lastReceivedAt, now);
  const receivedClock =
    (feed.state === 'live' || feed.state === 'stale') && lastReceivedAt !== null
      ? formatFeedClock(lastReceivedAt, timeZone)
      : null;
  const label = receivedClock
    ? t('monitoring:hud.feed.receivedAt', { time: receivedClock })
    : t(`monitoring:hud.feed.${feed.state}`);
  const Icon =
    feed.state === 'closed'
      ? WifiOff
      : feed.state === 'connecting'
        ? LoaderCircle
        : Wifi;
  return (
    <span
      className="flex items-center justify-between gap-3"
      title={t('monitoring:hud.feedTitle')}
    >
      <Icon
        className={cn(
          'size-3.25 shrink-0',
          FEED_TONE_ICON_CLASS[feed.tone],
          feed.state === 'connecting' &&
            'animate-spin motion-reduce:animate-none',
        )}
        role="img"
        aria-label={label}
      />
      <span className={FEED_TONE_TEXT_CLASS[feed.tone]}>{label}</span>
    </span>
  );
}
