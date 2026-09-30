import type { SunDayEvents } from '@crane/domain/3d';

/**
 * 시각 패널(scene-clock-panel)의 시각 프리셋 — 일출·정오·일몰·자정.
 *
 * 패널은 이 목록을 아이콘 토글 묶음으로 그리고, 지금 씬 시각과 같은 분의
 * 프리셋을 선택 상태로 보인다. 비교가 분 단위인 이유: 패널은 시각을 분까지만
 * 보여 주므로(툴팁 "일출 05:43") 슬라이더로 같은 분에 맞춰도 선택돼야 한다.
 */

export const SCENE_CLOCK_PRESET_KEYS = [
  'sunrise',
  'noon',
  'sunset',
  'midnight',
] as const;

export type SceneClockPresetKey = (typeof SCENE_CLOCK_PRESET_KEYS)[number];

export interface SceneClockPreset {
  key: SceneClockPresetKey;
  /** 그 날의 해당 시각(UTC epoch ms). 극지처럼 사건이 없으면 null. */
  ms: number | null;
}

const MINUTE_MS = 60_000;

/**
 * 현장 날짜 하나의 프리셋 목록. 자정은 그 현장 날짜의 시작
 * (startOfZonedDay)이고, 나머지는 태양 사건이다.
 */
export function buildSceneClockPresets(
  events: SunDayEvents | null,
  dayStartMs: number,
): SceneClockPreset[] {
  return [
    { key: 'sunrise', ms: finiteOrNull(events?.sunrise) },
    { key: 'noon', ms: finiteOrNull(events?.solarNoon) },
    { key: 'sunset', ms: finiteOrNull(events?.sunset) },
    { key: 'midnight', ms: finiteOrNull(dayStartMs) },
  ];
}

/**
 * 씬 시각과 같은 분의 프리셋. 없으면 null, 여럿이면 목록 앞쪽. 시각 자체가
 * 유한하지 않으면 아무것도 고르지 않는다.
 */
export function findActiveClockPreset(
  timeMs: number,
  presets: readonly SceneClockPreset[],
): SceneClockPresetKey | null {
  if (!Number.isFinite(timeMs)) return null;
  const minute = Math.floor(timeMs / MINUTE_MS);
  for (const preset of presets) {
    if (preset.ms !== null && Math.floor(preset.ms / MINUTE_MS) === minute) {
      return preset.key;
    }
  }
  return null;
}

function finiteOrNull(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
