import { Activity, Bell, Clock, Wind, WifiOff } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { AlarmSeverity } from '@crane/domain/alarm';
import { cn } from '@crane/core/lib/utils';
import {
  countRuntimeStatuses,
  type RuntimeStatusRecord,
} from '../lib/model-runtime-status';
import {
  compassPoint,
  formatClockHm,
  resolveWindAdvisory,
} from '../lib/wind-advisory';
import { useSceneSunState } from '../model/use-scene-sun-state';
import { useSceneWeather } from '../model/use-scene-weather';

/**
 * 관제 요약 HUD — 3D 캔버스 상단 중앙 한 줄.
 * `현장 시각 · 풍속 · 가동 n/N · 두절 m · 알람 k`
 *
 * 값의 출처는 전부 이미 있는 것들이다: 현장 시각은 씬 시계(useSceneSunState,
 * 리플레이면 프레임 시각), 풍속은 현장 좌표의 open-meteo(useSceneWeather),
 * 가동·두절은 태그 활동 기반 운전 상태(useModelRuntimeStatuses — 뷰가 한 번
 * 판정해 넘긴다), 알람은 페이지가 넘긴 크레인별 활성 알람. 클릭할 것이
 * 없어 pointer-events-none — 아래 캔버스 조작을 막지 않는다.
 *
 * 각 칸은 [아이콘·작은 라벨 / 큰 값] 세로 2줄이라 값이 먼저 읽힌다. 색
 * 규칙: 풍속은 작업 권고 단계(lib/wind-advisory — 주의 amber·중지 red), 가동은
 * 1대라도 돌면 emerald, 두절은 1대라도 있으면 amber(0이면 칸 자체를 숨김),
 * 알람은 최고 severity 색이고 0이면 흰색. 충돌 경보 배너와 같은 상단 중앙을
 * 쓰므로 Monitoring3dView 가 배너를 이 아래(top-16)로 내린다.
 */

const SEVERITY_ORDER: AlarmSeverity[] = ['critical', 'high', 'medium', 'info'];
const SEVERITY_VALUE_CLASS: Record<AlarmSeverity, string> = {
  critical: 'text-red-400',
  high: 'text-orange-400',
  medium: 'text-amber-300',
  info: 'text-sky-300',
};

interface SceneStatusHudProps {
  regionId: string;
  runtimeStatuses: RuntimeStatusRecord;
  alarmsByCraneId: Record<string, AlarmSeverity>;
  /** 시각 출처 — 리플레이 화면은 'replay'. */
  timeSource?: 'clock' | 'replay';
  className?: string;
}

export function SceneStatusHud({
  regionId,
  runtimeStatuses,
  alarmsByCraneId,
  timeSource = 'clock',
  className,
}: SceneStatusHudProps) {
  const { t } = useTranslation();
  const sun = useSceneSunState(regionId, timeSource);
  const weather = useSceneWeather(regionId);
  const counts = countRuntimeStatuses(runtimeStatuses);
  const clock = sun?.parts
    ? formatClockHm(sun.parts.hour, sun.parts.minute)
    : null;
  const advisory = resolveWindAdvisory(weather?.windSpeed);
  const direction = compassPoint(weather?.windDirection);
  const hasWind =
    weather?.windSpeed !== null && weather?.windSpeed !== undefined;

  const alarmCranes = Object.keys(alarmsByCraneId).length;
  const topSeverity = SEVERITY_ORDER.find((severity) =>
    Object.values(alarmsByCraneId).includes(severity),
  );

  return (
    <div
      data-slot="scene-status-hud"
      className={cn(
        'pointer-events-none absolute top-3 left-1/2 z-10 flex -translate-x-1/2 items-stretch divide-x divide-white/15 rounded-lg border border-white/15 bg-black/75 px-1 text-white shadow-lg backdrop-blur-md',
        className,
      )}
    >
      <HudCell
        icon={<Clock className="size-3.5" aria-hidden />}
        label={t('monitoring:hud.siteTime')}
        value={clock ?? '--:--'}
      />
      <HudCell
        icon={<Wind className="size-3.5" aria-hidden />}
        label={
          advisory === 'stop'
            ? t('monitoring:hud.windStopShort')
            : advisory === 'caution'
              ? t('monitoring:hud.windCautionShort')
              : t('monitoring:hud.wind')
        }
        title={
          advisory === 'stop'
            ? t('monitoring:hud.windStop')
            : advisory === 'caution'
              ? t('monitoring:hud.windCaution')
              : undefined
        }
        value={
          hasWind
            ? `${weather.windSpeed!.toFixed(1)} m/s${direction ? ` ${direction}` : ''}`
            : t('monitoring:hud.windUnavailable')
        }
        valueClassName={cn(
          advisory === 'caution' && 'text-amber-300',
          advisory === 'stop' && 'text-red-400',
          !hasWind && 'text-white/50',
        )}
      />
      <HudCell
        icon={<Activity className="size-3.5" aria-hidden />}
        label={t('monitoring:hud.runningShort')}
        title={t('monitoring:hud.running')}
        value={`${counts.running} / ${counts.known}`}
        valueClassName={counts.running > 0 ? 'text-emerald-300' : undefined}
      />
      {counts.offline > 0 ? (
        <HudCell
          icon={<WifiOff className="size-3.5" aria-hidden />}
          label={t('monitoring:hud.offlineShort')}
          title={t('monitoring:hud.offline')}
          value={String(counts.offline)}
          valueClassName="text-amber-300"
        />
      ) : null}
      <HudCell
        icon={<Bell className="size-3.5" aria-hidden />}
        label={t('monitoring:hud.alarmsShort')}
        title={t('monitoring:hud.alarms')}
        value={String(alarmCranes)}
        valueClassName={
          topSeverity ? SEVERITY_VALUE_CLASS[topSeverity] : undefined
        }
      />
    </div>
  );
}

function HudCell({
  icon,
  label,
  title,
  value,
  valueClassName,
}: {
  icon: ReactNode;
  label: string;
  title?: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div
      className="flex min-w-16 flex-col justify-center gap-0.5 px-3 py-1.5"
      title={title ?? label}
    >
      <span className="inline-flex items-center gap-1 text-[10px] leading-none font-medium tracking-wide text-white/60 uppercase">
        {icon}
        {label}
      </span>
      <span
        className={cn(
          'font-mono text-base leading-5 font-bold whitespace-nowrap tabular-nums',
          valueClassName,
        )}
      >
        {value}
      </span>
    </div>
  );
}
