import { Moon, RotateCcw, Sun, Sunrise, Sunset } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  SCENE_SITE_LOCATIONS,
  formatSceneSiteLocation,
  isSceneSiteLocation,
  type SceneSiteLocation,
} from '@crane/domain/3d';
import { getFormatLocale } from '@crane/core/config/i18n';
import {
  setZonedMinuteOfDay,
  startOfZonedDay,
  zonedWallTimeToUtc,
} from '@crane/core/lib/time-zone';
import { cn } from '@crane/core/lib/utils';
import { Button } from '@crane/ui/atoms/button';
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
} from '@crane/ui/molecules/select';
import { ToggleGroup, ToggleGroupItem } from '@crane/ui/molecules/toggle-group';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@crane/ui/molecules/tooltip';
import {
  buildSceneClockPresets,
  findActiveClockPreset,
  type SceneClockPresetKey,
} from '../lib/scene-clock-presets';
import type { SkyPhase } from '../lib/sky-lighting';
import type { SceneTimeSource } from '../model/scene-time-source';
import { useSceneClockStore } from '../model/use-scene-clock-store';
import { useSceneSunState } from '../model/use-scene-sun-state';

interface SceneClockPanelProps {
  regionId: string;
  /**
   * 씬의 지역(시간 기준, `SavedSceneInfo.siteLocation`). 미지정이면 region
   * 기본 지역.
   */
  siteLocation?: SceneSiteLocation;
  /**
   * 있으면 날짜 위에 지역 드롭다운을 그린다 — 에디터 배경 탭만 넘긴다.
   * 없으면(모니터링) 지역은 날짜 옆 이름으로만 보이고 바꿀 수 없다.
   */
  onSiteLocationChange?: (location: SceneSiteLocation) => void;
  /** 시각 출처 — 리플레이 화면은 'replay'(프레임 시각을 따라가며 조작 불가). */
  source?: SceneTimeSource;
  /**
   * 씬의 태양 모드가 solar 인지. false 면 시각을 바꿔도 화면이 변하지 않으니
   * 안내 문구를 보이고 조작을 잠근다(값 자체는 전역이라 켜면 바로 반영).
   */
  solarEnabled: boolean;
}

const MINUTES_PER_DAY = 1440;
/** 시각 슬라이더 아래 눈금 — 슬라이더가 하루(00~24시)라는 것을 보인다. */
const TIME_AXIS_LABELS = ['00', '06', '12', '18', '24'];

const PRESET_ICON: Record<SceneClockPresetKey, typeof Sun> = {
  sunrise: Sunrise,
  noon: Sun,
  sunset: Sunset,
  midnight: Moon,
};

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
 * 위: 현재 위상(낮·새벽·황혼·밤)과 현장 벽시계·날짜·지역, 태양 방위·고도.
 * 아래: 시각 출처 표시(현재 시각 초록 점 / 지정 시각 주황 점 + 현재 시각으로
 * 버튼), 지역 드롭다운(에디터만), 날짜·시각 슬라이더(00~24시 눈금)·프리셋
 * 아이콘 토글(일출·정오·일몰·자정 — 시각은 툴팁). 실시간 중에도 조작 UI 가
 * 보이고, 바꾸는 순간 지정 시각이 된다.
 * 값은 useSceneClockStore(세션 전역)에 있고 여기서는 그리기만 한다 —
 * 슬라이더 ↔ epoch 변환은 core/lib/time-zone, 프리셋 판정은
 * lib/scene-clock-presets.
 *
 * 리플레이는 프레임 시각이 곧 씬 시각이라 조작 UI 를 두지 않는다.
 */
export const SceneClockPanel = memo(function SceneClockPanel({
  regionId,
  siteLocation,
  onSiteLocationChange,
  source = 'clock',
  solarEnabled,
}: SceneClockPanelProps) {
  const { t, i18n } = useTranslation();
  const state = useSceneSunState(regionId, siteLocation, source);
  const mode = useSceneClockStore((s) => s.mode);
  const setLive = useSceneClockStore((s) => s.setLive);
  const setManualTime = useSceneClockStore((s) => s.setManualTime);

  if (!state) {
    return (
      <p className="text-muted-foreground text-[11px] leading-snug">
        {t('monitoring:sceneClock.noGeo')}
      </p>
    );
  }

  const { location, geo, timeMs, parts, snapshot, events, timeOrigin } = state;
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
  const presets = buildSceneClockPresets(
    events,
    startOfZonedDay(timeMs, timeZone),
  );
  const activePreset = findActiveClockPreset(timeMs, presets);

  const sunBelow = snapshot.sun.elevation < 0;

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
            {dateFormatter.format(timeMs)}
            {/* 드롭다운이 있으면 같은 이름을 두 번 쓰지 않는다. */}
            {onSiteLocationChange
              ? null
              : ` · ${formatSceneSiteLocation(location)}`}
          </p>
        </div>
      </div>

      {/* 태양 위치 */}
      <div className="flex items-center justify-between gap-3 text-[10px] tabular-nums">
        <span className="text-muted-foreground">
          {t('monitoring:sceneClock.sun')}
        </span>
        <span className="text-foreground">
          {sunBelow
            ? t('monitoring:sceneClock.belowHorizon')
            : `${t('monitoring:sceneClock.azimuth')} ${Math.round(snapshot.sun.azimuth)}° · ${t('monitoring:sceneClock.elevation')} ${Math.round(snapshot.sun.elevation)}°`}
        </span>
      </div>

      {isReplay ? (
        <p className="text-muted-foreground text-[10px] leading-snug">
          {t('monitoring:sceneClock.replayHint')}
        </p>
      ) : (
        <div className="border-border flex flex-col gap-2 border-t pt-2">
          {/* 시각 출처 — 처음엔 현재 시각(초록 점), 날짜·슬라이더·프리셋으로
            바꾸면 지정 시각(주황 점)과 되돌리기 버튼. 줄 높이를 고정해
            버튼이 나타나도 아래가 밀리지 않는다. */}
          <div className="flex h-6 items-center justify-between gap-2 text-[10px]">
            <span className="flex items-center gap-1.5">
              <span
                aria-hidden
                className={cn(
                  'size-2 shrink-0 rounded-full',
                  isManual ? 'bg-orange-500' : 'bg-emerald-500',
                )}
              />
              <span className="text-foreground font-medium">
                {isManual
                  ? t('monitoring:sceneClock.manual')
                  : t('monitoring:sceneClock.live')}
              </span>
            </span>
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

          {/* 지역 — 에디터만 바꾼다(onSiteLocationChange 가 있을 때만 보인다). */}
          {onSiteLocationChange ? (
            <div className="flex items-center justify-between gap-2 text-[10px]">
              <span className="text-muted-foreground">
                {t('monitoring:sceneClock.siteLocation')}
              </span>
              <Select
                value={location}
                onValueChange={(value: unknown) => {
                  if (isSceneSiteLocation(value)) onSiteLocationChange(value);
                }}
              >
                <SelectTrigger
                  aria-label={t('monitoring:sceneClock.siteLocation')}
                  className="h-6 min-w-0 px-1.5 text-[10px] font-normal"
                >
                  <span className="truncate">
                    {formatSceneSiteLocation(location)}
                  </span>
                </SelectTrigger>
                <SelectPopup align="end">
                  {SCENE_SITE_LOCATIONS.map((item) => (
                    <SelectItem key={item} value={item} className="text-[11px]">
                      {formatSceneSiteLocation(item)}
                    </SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            </div>
          ) : null}

          <label className="flex items-center justify-between gap-2 text-[10px]">
            <span className="text-muted-foreground">
              {t('monitoring:sceneClock.date')}
            </span>
            {/* 네이티브 달력 아이콘은 검정이라 다크 테마에서 배경에 묻힌다 —
              scheme-dark 로 아이콘·달력 팝업을 어두운 테마로 그린다. */}
            <input
              type="date"
              value={parts ? toDateInputValue(parts) : ''}
              disabled={controlsDisabled}
              className="border-border bg-background text-foreground h-6 rounded-md border px-1.5 text-[10px] tabular-nums dark:scheme-dark [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-60 hover:[&::-webkit-calendar-picker-indicator]:opacity-90"
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

          {/* 시각 — 라벨 줄 오른쪽에 프리셋, 슬라이더 아래 00~24시 눈금 */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-2 text-[10px]">
              <span className="text-muted-foreground">
                {t('monitoring:sceneClock.timeOfDay')}
              </span>
              <ToggleGroup
                value={activePreset ? [activePreset] : []}
                onValueChange={(next) => {
                  const preset = presets.find((p) => p.key === next[0]);
                  if (preset && preset.ms !== null) {
                    setManualTime(preset.ms);
                  }
                }}
                variant="outline"
                size="sm"
                aria-label={t('monitoring:sceneClock.presets')}
              >
                {presets.map((preset) => {
                  const Icon = PRESET_ICON[preset.key];
                  const label = `${t(`monitoring:sceneClock.${preset.key}`)} ${formatTime(preset.ms)}`;
                  return (
                    <Tooltip key={preset.key}>
                      <TooltipTrigger
                        render={
                          <ToggleGroupItem
                            value={preset.key}
                            disabled={controlsDisabled || preset.ms === null}
                            aria-label={label}
                            className="h-6 px-2"
                          />
                        }
                      >
                        <Icon className="size-3.5" />
                      </TooltipTrigger>
                      <TooltipContent>{label}</TooltipContent>
                    </Tooltip>
                  );
                })}
              </ToggleGroup>
            </div>
            <div className="flex flex-col gap-1">
              <input
                type="range"
                min={0}
                max={MINUTES_PER_DAY - 1}
                step={5}
                value={minuteOfDay}
                disabled={controlsDisabled}
                aria-label={t('monitoring:sceneClock.timeOfDay')}
                aria-valuetext={timeFormatter.format(timeMs)}
                className="accent-primary h-2 w-full cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
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
                className="text-muted-foreground flex justify-between font-mono text-[9px] tabular-nums"
              >
                {TIME_AXIS_LABELS.map((axisLabel) => (
                  <span key={axisLabel}>{axisLabel}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
