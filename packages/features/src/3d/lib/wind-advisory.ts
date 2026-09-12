/**
 * 풍속 → 크레인 작업 권고 단계. 관제 HUD 의 풍속 표시 색과 문구가 쓴다.
 *
 * 기준값은 일반적인 타워크레인·골리앗 운전 지침의 관행(주의 10 m/s, 작업
 * 중지 15 m/s)이다. 현장별 규정이 다르면 이 두 상수만 바꾼다 — 실제 풍속계
 * 태그가 연결되면 출처만 바뀌고 판정은 그대로다.
 */
export const WIND_CAUTION_MS = 10;
export const WIND_STOP_MS = 15;

export type WindAdvisory = 'normal' | 'caution' | 'stop';

/** 풍속(m/s) → 단계. 음수·NaN·null 은 null(표시 안 함). 경계값은 상위 단계. */
export function resolveWindAdvisory(
  windSpeed: number | null | undefined,
): WindAdvisory | null {
  if (
    windSpeed === null ||
    windSpeed === undefined ||
    !Number.isFinite(windSpeed) ||
    windSpeed < 0
  ) {
    return null;
  }
  if (windSpeed >= WIND_STOP_MS) return 'stop';
  if (windSpeed >= WIND_CAUTION_MS) return 'caution';
  return 'normal';
}

/** 풍향(도, 0=북, 시계 방향) → 16방위 약호(N·NNE·…). NaN 은 null. */
const COMPASS_POINTS = [
  'N',
  'NNE',
  'NE',
  'ENE',
  'E',
  'ESE',
  'SE',
  'SSE',
  'S',
  'SSW',
  'SW',
  'WSW',
  'W',
  'WNW',
  'NW',
  'NNW',
] as const;

export function compassPoint(
  degrees: number | null | undefined,
): (typeof COMPASS_POINTS)[number] | null {
  if (degrees === null || degrees === undefined || !Number.isFinite(degrees)) {
    return null;
  }
  const normalized = ((degrees % 360) + 360) % 360;
  return COMPASS_POINTS[Math.round(normalized / 22.5) % 16];
}

/** 현장 벽시계 HH:MM. 시·분이 정수가 아니면 null. */
export function formatClockHm(hour: number, minute: number): string | null {
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}
