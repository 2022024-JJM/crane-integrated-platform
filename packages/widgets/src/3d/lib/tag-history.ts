import {
  parseIsoMs,
  toTagNumber,
  type CraneHistoryFrames,
} from '@crane/domain/monitoring';

/** 미리보기 스파크라인 한 점 — 수신(또는 이력 프레임) 시각과 숫자 값. */
export interface TagSample {
  t: number;
  v: number;
}

/** 미리보기가 보여 주는 창. 이력 API 조회 범위이자 라이브 표본의 보존 길이. */
export const TAG_HISTORY_WINDOW_MS = 60_000;

const NO_SAMPLES: readonly TagSample[] = [];

/** 이력 프레임에서 한 태그의 표본만 뽑는다. 숫자로 못 바꾸는 값·시각은 버린다. */
export function historySamples(
  frames: Pick<CraneHistoryFrames, 'frames'>,
  code: string,
): readonly TagSample[] {
  const out: TagSample[] = [];
  for (const frame of frames.frames) {
    const t = parseIsoMs(frame.time);
    const v = toTagNumber(frame.values[code]);
    if (t === null || v === null) continue;
    out.push({ t, v });
  }
  return out.length > 0 ? out : NO_SAMPLES;
}

/**
 * 표본을 뒤에 붙이고 창 밖(가장 최근 표본 기준 `windowMs` 이전)은 버린다.
 * 같은 시각이 이미 끝에 있으면 값만 바꾼다(묶음 안에서 재발행된 같은 값).
 */
export function appendSample(
  samples: readonly TagSample[],
  sample: TagSample,
  windowMs = TAG_HISTORY_WINDOW_MS,
): readonly TagSample[] {
  if (!Number.isFinite(sample.t) || !Number.isFinite(sample.v)) return samples;
  const last = samples[samples.length - 1];
  const next =
    last && last.t === sample.t
      ? [...samples.slice(0, -1), sample]
      : [...samples, sample];
  const cutoff = sample.t - windowMs;
  let start = 0;
  while (start < next.length - 1 && next[start].t < cutoff) start += 1;
  return start > 0 ? next.slice(start) : next;
}

/**
 * 스파크라인 polyline 의 points 문자열. x 는 시각(한 점이면 가운데), y 는
 * 값 범위를 위아래 여백 안에 편다. 값이 전부 같으면 가운데 수평선.
 */
export function sparklinePoints(
  samples: readonly TagSample[],
  width: number,
  height: number,
  pad = 2,
): string {
  if (samples.length === 0) return '';
  let tMin = Number.POSITIVE_INFINITY;
  let tMax = Number.NEGATIVE_INFINITY;
  let vMin = Number.POSITIVE_INFINITY;
  let vMax = Number.NEGATIVE_INFINITY;
  for (const { t, v } of samples) {
    if (t < tMin) tMin = t;
    if (t > tMax) tMax = t;
    if (v < vMin) vMin = v;
    if (v > vMax) vMax = v;
  }
  const tSpan = tMax - tMin;
  const vSpan = vMax - vMin;
  const innerH = Math.max(height - pad * 2, 0);
  return samples
    .map(({ t, v }) => {
      const x = tSpan > 0 ? ((t - tMin) / tSpan) * width : width / 2;
      const y =
        vSpan > 0 ? height - pad - ((v - vMin) / vSpan) * innerH : height / 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}
