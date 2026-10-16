import type { Box3 } from 'three';
import type { Vector3Tuple } from '@crane/core/types/math';

/**
 * 모델 라벨 앵커(모델 로컬, unscaled) — ui/model-mesh.tsx 의 훅이 bbox 를 재서
 * 여기로 넘긴다.
 *
 * - 기본: 전체 bbox 의 XZ 중심, 높이는 bbox 꼭대기 + 여유. 원근에서 모델
 *   머리 위에 뜨는 자리다.
 * - 평면도: **바닥에 닿은 메쉬들의 발자국 중심**. 타워크레인은 상부(지브)
 *   bbox 중심이 마스트에서 수십 m 떨어져 있어 전체 중심을 쓰면 라벨이 지브
 *   끝 허공에 서고, 선회해도 그 자리에 남아 "어느 장비 것인지" 가 흐려진다.
 *   바닥 메쉬(마스트·베이스·갠트리 다리)의 중심은 선회·기복과 무관한 축이라
 *   라벨이 장비에 붙어 있다. 바닥 판정은 전체 최저점에서 높이의 일정 비율
 *   안에 바닥이 있는 메쉬다. 단일 메쉬 모델은 결과가 기본과 같다.
 */

/** 라벨을 bbox 꼭대기에서 띄우는 여유(unscaled 단위). */
export const LABEL_ANCHOR_TOP_PADDING = 0.2;
/** 바닥 메쉬 판정 — 전체 높이의 이 비율 안에 min.y 가 있으면 바닥에 닿은 것. */
export const PLAN_LABEL_BASE_RATIO = 0.1;
/** bbox 가 없을 때의 폴백. */
export const LABEL_ANCHOR_FALLBACK: Vector3Tuple = [0, 2, 0];

export function defaultLabelAnchorFromBox(box: Box3): Vector3Tuple {
  if (box.isEmpty()) return LABEL_ANCHOR_FALLBACK;
  return [
    (box.min.x + box.max.x) / 2,
    box.max.y + LABEL_ANCHOR_TOP_PADDING,
    (box.min.z + box.max.z) / 2,
  ];
}

/**
 * 평면도 앵커 — 메쉬별 bbox 중 바닥에 닿은 것들의 XZ 합집합 중심. 높이는 전체
 * 꼭대기(직교 투영이라 보이는 자리는 XZ 가 정한다). 빈 목록은 폴백.
 */
export function planLabelAnchorFromBoxes(
  boxes: readonly Box3[],
  baseRatio: number = PLAN_LABEL_BASE_RATIO,
): Vector3Tuple {
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const box of boxes) {
    if (box.isEmpty()) continue;
    if (box.min.y < minY) minY = box.min.y;
    if (box.max.y > maxY) maxY = box.max.y;
  }
  if (!Number.isFinite(minY)) return LABEL_ANCHOR_FALLBACK;
  const threshold = minY + Math.max(0, maxY - minY) * baseRatio;
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  for (const box of boxes) {
    if (box.isEmpty() || box.min.y > threshold) continue;
    if (box.min.x < minX) minX = box.min.x;
    if (box.max.x > maxX) maxX = box.max.x;
    if (box.min.z < minZ) minZ = box.min.z;
    if (box.max.z > maxZ) maxZ = box.max.z;
  }
  return [
    (minX + maxX) / 2,
    maxY + LABEL_ANCHOR_TOP_PADDING,
    (minZ + maxZ) / 2,
  ];
}
