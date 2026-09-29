import type { TagMapping } from '../model/tag-mapping-types';

/**
 * 모델 라벨 위에 쌓이는 태그 값(ACMS 매뉴얼 II-6 의 GC 원점 거리가 출발점).
 * 값은 맵핑의 scale·offset 을 거치지 않은 **태그 원시값**이다 — 화면 구성이
 * 틀려도 숫자는 PLC 와 같아야 한다.
 *
 * 라벨(ui/model-label.tsx)은 domain 이라 값 버스를 모른다. 읽기 함수는
 * features 가 넘기고, 여기에는 목록 구성과 표기만 둔다.
 */
export interface ModelLabelReading {
  /** 맵핑 id — 렌더 key. */
  id: string;
  /** 값 앞의 짧은 이름. 빈 문자열이면 숫자만 그린다. */
  caption: string;
  tagKey: string;
}

/** 값을 읽는 함수. 아직 값이 없으면 undefined. */
export type ModelLabelValueReader = (tagKey: string) => number | undefined;

/** 값이 아직 없을 때의 표기. */
export const LABEL_READING_EMPTY = '—';

/** 소수 자릿수 — ACMS 표기(777.2)와 같다. */
export const LABEL_READING_DECIMALS = 1;

const NO_READINGS: readonly ModelLabelReading[] = [];

/**
 * 라벨에 보일 맵핑만 골라 목록으로 만든다. 없으면 **같은 빈 배열 참조**를
 * 돌려준다 — 모델마다 새 배열을 만들면 memo 된 GltfModel 이 렌더마다 다시
 * 그려진다.
 */
export function buildLabelReadings(
  mappings: readonly TagMapping[] | undefined,
): readonly ModelLabelReading[] {
  if (!mappings) return NO_READINGS;
  const readings: ModelLabelReading[] = [];
  for (const mapping of mappings) {
    if (mapping.showOnLabel !== true) continue;
    if (!mapping.tagKey) continue;
    readings.push({
      id: mapping.id,
      caption: mapping.caption ?? '',
      tagKey: mapping.tagKey,
    });
  }
  return readings.length > 0 ? readings : NO_READINGS;
}

/** 값 표기 — 소수 1자리. 값이 없거나 비유한이면 `—`. */
export function formatLabelReading(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) {
    return LABEL_READING_EMPTY;
  }
  const fixed = value.toFixed(LABEL_READING_DECIMALS);
  // -0.04 → "-0.0" 은 "0.0" 으로.
  return Number(fixed) === 0 ? (0).toFixed(LABEL_READING_DECIMALS) : fixed;
}
