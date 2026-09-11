import { Moon, RotateCcw, Sun, Sunrise, Sunset } from 'lucide-react';
import { memo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { getFormatLocale } from '@crane/core/config/i18n';
import {
  setZonedMinuteOfDay,
  startOfZonedDay,
  zonedWallTimeToUtc,
} from '@crane/core/lib/time-zone';
import { cn } from '@crane/core/lib/utils';
import { Button } from '@crane/ui/atoms/button';
import { Switch } from '@crane/ui/atoms/switch';
import { ToggleGroup, ToggleGroupItem } from '@crane/ui/molecules/toggle-group';
import type { SkyPhase } from '../lib/sky-lighting';
import type { SceneTimeSource } from '../model/scene-time-source';
import { useSceneClockStore } from '../model/use-scene-clock-store';
import { useSceneSunState } from '../model/use-scene-sun-state';

interface SceneClockPanelProps {
  regionId: string;
  /** 시각 출처 — 리플레이 화면은 'replay'(프레임 시각을 따라가며 조작 불가). */
  source?: SceneTimeSource;
  /**
   * 씬의 태양 모드가 solar 인지. false 면 시각을 바꿔도 화면이 변하지 않으니
   * 안내 문구를 보이고 조작을 잠근다(값 자체는 전역이라 켜면 바로 반영).
   */
  solarEnabled: boolean;
}

const MINUTES_PER_DAY = 1440;

const PHASE_ICON: Record<SkyPhase, typeof Sun> = {
  day: Sun,
  dawn: Sunrise,
  dusk: Sunset,
  night: Moon,
};

function toDateInputValue(parts: {
  year: number;
  month: number;
  day: number;
}): string {
  const mm = String(parts.month).padStart(2, '0');
  const dd = String(parts.day).padStart(2, '0');
  return `${parts.year}-${mm}-${dd}`;
}

/**
 * 현장 시각 · 낮/밤 패널 — 모니터링 독 팝업(SceneClockMenu)과 에디터 배경
 * 탭(palette-environment-section)이 함께 쓴다.
 *
 * 위: 현재 위상(낮·새벽·황혼·밤)과 현장 벽시계, 태양·달 방위·고도.
 * 아래: 시각 출처 전환(실시간 / 시각 지정)과, 지정 모드의 날짜·시각 슬라이더·
 * 프리셋(일출·정오·일몰·자정). 값은 useSceneClockStore(세션 전역)에 있고
 * 여기서는 그리기만 한다 — 슬라이더 ↔ epoch 변환은 core/lib/time-zone.
 *
 * 리플레이는 프레임 시각이 곧 씬 시각이라 조작 UI 를 두지 않는다.
 */
export const SceneClockPanel = memo(function SceneClockPanel({
  regionId,
  source = 'clock',
  solarEnabled,
}: SceneClockPanelProps) {
  const { t, i18n } = useTranslation();
  const state = useSceneSunState(regionId, source);
  const mode = useSceneClockStore((s) => s.mode);
  const setLive = useSceneClockStore((s) => s.setLive);
  const setManualTime = useSceneClockStore((s) => s.setManualTime);
  const yardLights = useSceneClockStore((s) => s.yardLights);
  const setYardLights = useSceneClockStore((s) => s.setYardLights);

  if (!state) {
    return (
      <p className="text-muted-foreground text-[11px] leading-snug">
        {t('monitoring:sceneClock.noGeo')}
      </p>
    );
  }

  const { geo, timeMs, parts, snapshot, events, timeOrigin } = state;
  const locale = getFormatLocale(i18n.language);
  const timeZone = geo.timeZone;
  const timeFormatter = new Intl.DateTimeFormat(locale, {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const dateFormatter = new Intl.DateTimeFormat(locale, {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  });
  const formatTime = (ms: number | null) =>
    ms === null ? t('monitoring:sceneClock.noEvent') : timeFormatter.format(ms);

  const PhaseIcon = PHASE_ICON[snapshot.phase];
  const isReplay = timeOrigin === 'replay';
  const isManual = mode === 'manual' && !isReplay;
  const controlsDisabled = !solarEnabled || isReplay;
  const minuteOfDay = parts?.minuteOfDay ?? 0;
  const dayStart = startOfZonedDay(timeMs, timeZone);
  const markerPercent = (ms: number | null) =>
    ms === null
      ? null
      : Math.min(100, Math.max(0, ((ms - dayStart) / 86_400_000) * 100));

  const sunBelow = snapshot.sun.elevation < 0;
  const moonBelow = snapshot.moon.elevation < 0;
  const moonPercent = Math.round(snapshot.moonIllumination.fraction * 100);

  const presets: Array<{
    key: string;
    label: string;
    ms: number | null;
    icon: ReactNode;
  }> = [
    {
      key: 'sunrise',
      label: t('monitoring:sceneClock.sunrise'),
      ms: events?.sunrise ?? null,
      icon: <Sunrise className="size-3" />,
    },
    {
      key: 'noon',
      label: t('monitoring:sceneClock.noon'),
      ms: events?.solarNoon ?? null,
      icon: <Sun className="size-3" />,
    },
    {
      key: 'sunset',
      label: t('monitoring:sceneClock.sunset'),
      ms: events?.sunset ?? null,
      icon: <Sunset className="size-3" />,
    },
    {
      key: 'midnight',
      label: t('monitoring:sceneClock.midnight'),
      ms: dayStart,
      icon: <Moon className="size-3" />,
    },
  ];

  return (
    <div className="flex flex-col gap-2">
      {!solarEnabled ? (
        <p className="text-muted-foreground border-border bg-muted/40 rounded-md border px-2 py-1.5 text-[10px] leading-snug">
          {t('monitoring:sceneClock.manualOff')}
        </p>
      ) : null}

      {/* 위상 + 현장 시각 */}
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-full border',
            snapshot.phase === 'night'
              ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-500 dark:text-indigo-300'
              : 'border-amber-500/40 bg-amber-500/10 text-amber-500',
          )}
        >
          <PhaseIcon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-foreground font-mono text-lg leading-none font-semibold tabular-nums">
              {timeFormatter.format(timeMs)}
            </span>
            <span className="text-foreground text-[11px] font-medium">
              {t(`monitoring:sceneClock.phase.${snapshot.phase}`)}
            </span>
          </div>
          <p className="text-muted-foreground truncate text-[10px] tabular-nums">
            {dateFormatter.format(timeMs)} ·{' '}
            {t('monitoring:sceneClock.timeZone', { timeZone })}
          </p>
        </div>
      </div>

      {/* 태양·달 위치 */}
      {/* 라벨 열은 내용 폭, 값 열이 나머지를 차지 — 달 행(방위·고도·조명)이 줄바꿈되지 않게. */}
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[10px] tabular-nums">
        <dt className="text-muted-foreground">
          {t('monitoring:sceneClock.sun')}
        </dt>
        <dd className="text-foreground text-right">
          {sunBelow
            ? t('monitoring:sceneClock.belowHorizon')
            : `${t('monitoring:sceneClock.azimuth')} ${Math.round(snapshot.sun.azimuth)}° · ${t('monitoring:sceneClock.elevation')} ${Math.round(snapshot.sun.elevation)}°`}
        </dd>
        <dt className="text-muted-foreground">
          {t('monitoring:sceneClock.moon')}
        </dt>
        <dd className="text-foreground text-right">
          {moonBelow
            ? t('monitoring:sceneClock.belowHorizon')
            : `${t('monitoring:sceneClock.azimuth')} ${Math.round(snapshot.moon.azimuth)}° · ${t('monitoring:sceneClock.elevation')} ${Math.round(snapshot.moon.elevation)}°`}{' '}
          <span className="text-muted-foreground">
            (
            {t('monitoring:sceneClock.moonIllumination', {
              percent: moonPercent,
            })}
            )
          </span>
        </dd>
        <dt className="text-muted-foreground">
          {t('monitoring:sceneClock.sunrise')} /{' '}
          {t('monitoring:sceneClock.sunset')}
        </dt>
        <dd className="text-foreground text-right">
          {formatTime(events?.sunrise ?? null)} /{' '}
          {formatTime(events?.sunset ?? null)}
        </dd>
      </dl>

      {/* 야간 작업등 — 시각 출처와 무관한 렌더 옵션이라 리플레이에서도 보인다. */}
      <label className="border-border flex items-center justify-between gap-2 border-t pt-2 text-[11px]">
        <span className="text-foreground">
          {t('monitoring:sceneClock.yardLights')}
        </span>
        <Switch
          checked={yardLights}
          onCheckedChange={setYardLights}
          disabled={!solarEnabled}
          aria-label={t('monitoring:sceneClock.yardLights')}
        />
      </label>

      {isReplay ? (
        <p className="text-muted-foreground text-[10px] leading-snug">
          {t('monitoring:sceneClock.replayHint')}
        </p>
      ) : (
        <div className="border-border flex flex-col gap-2 border-t pt-2">
          <div className="flex items-center justify-between gap-2">
            <ToggleGroup
              value={[isManual ? 'manual' : 'live']}
              onValueChange={(next) => {
                const choice = next[0];
                if (choice === 'live') setLive();
                else if (choice === 'manual') setManualTime(timeMs);
              }}
              variant="outline"
              size="sm"
              aria-label={t('monitoring:sceneClock.title')}
            >
              <ToggleGroupItem
                value="live"
                disabled={controlsDisabled}
                className="h-6 px-2 text-[10px]"
              >
                {t('monitoring:sceneClock.live')}
              </ToggleGroupItem>
              <ToggleGroupItem
                value="manual"
                disabled={controlsDisabled}
                className="h-6 px-2 text-[10px]"
              >
                {t('monitoring:sceneClock.manual')}
              </ToggleGroupItem>
            </ToggleGroup>
            {isManual ? (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="text-muted-foreground h-6 gap-1 px-1.5 text-[10px]"
                onClick={setLive}
              >
                <RotateCcw className="size-3" />
                {t('monitoring:sceneClock.backToLive')}
              </Button>
            ) : null}
          </div>

          {isManual ? (
            <>
              <label className="flex items-center justify-between gap-2 text-[10px]">
                <span className="text-muted-foreground">
                  {t('monitoring:sceneClock.date')}
                </span>
                <input
                  type="date"
                  value={parts ? toDateInputValue(parts) : ''}
                  disabled={controlsDisabled}
                  className="border-border bg-background text-foreground h-6 rounded-md border px-1.5 text-[10px] tabular-nums"
                  onChange={(event) => {
                    const [y, m, d] = event.target.value
                      .split('-')
                      .map((v) => Number(v));
                    if (!y || !m || !d) return;
                    setManualTime(
                      zonedWallTimeToUtc(
                        {
                          year: y,
                          month: m,
                          day: d,
                          hour: parts?.hour ?? 12,
                          minute: parts?.minute ?? 0,
                        },
                        timeZone,
                      ),
                    );
                  }}
                />
              </label>

              {/* 시각 슬라이더 — 눈금은 일출·일몰 위치 */}
              <div className="relative pt-1">
                <input
                  type="range"
                  min={0}
                  max={MINUTES_PER_DAY - 1}
                  step={5}
                  value={minuteOfDay}
                  disabled={controlsDisabled}
                  aria-label={t('monitoring:sceneClock.timeOfDay')}
                  aria-valuetext={timeFormatter.format(timeMs)}
                  className="accent-primary relative z-10 h-2 w-full cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                  onChange={(event) =>
                    setManualTime(
                      setZonedMinuteOfDay(
                        timeMs,
                        Number(event.target.value),
                        timeZone,
                      ),
                    )
                  }
                />
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 top-0 flex h-1 justify-between"
                >
                  {[events?.sunrise ?? null, events?.sunset ?? null].map(
                    (ms, index) => {
                      const pct = markerPercent(ms);
                      return pct === null ? null : (
                        <span
                          key={index}
                          className="absolute top-0 h-full w-px bg-amber-500/70"
                          style={{ left: `${pct}%` }}
                        />
                      );
                    },
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-1">
                {presets.map((preset) => (
                  <Button
                    key={preset.key}
                    type="button"
                    variant="outline"
                    size="xs"
                    disabled={controlsDisabled || preset.ms === null}
                    className="h-6 gap-1 px-1.5 text-[10px]"
                    onClick={() => {
                      if (preset.ms !== null) setManualTime(preset.ms);
                    }}
                  >
                    {preset.icon}
                    {preset.label}
                    {preset.ms !== null ? (
                      <span className="text-muted-foreground font-mono tabular-nums">
                        {timeFormatter.format(preset.ms)}
                      </span>
                    ) : null}
                  </Button>
                ))}
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
});
