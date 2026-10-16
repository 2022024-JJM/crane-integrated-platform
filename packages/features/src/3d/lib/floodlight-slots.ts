import { floodlightAimPoint, type SavedFloodlightInfo } from '@crane/domain/3d';
import { FLOODLIGHT_SLOT_COUNT } from './floodlight-spot';

/**
 * SpotLight 슬롯 수. 기본은 조명 수와 상한 중 작은 쪽 — 로드 뒤 조명 수가
 * 변하지 않는 관제·3D 플레이에서 빈 슬롯의 픽셀 비용을 내지 않는다. reserve 는
 * 조명 수와 무관하게 상한 — 조명을 놓고 지우는 에디터용. 보이는 SpotLight
 * 수는 three 프로그램 캐시 키라 바뀌는 프레임마다 전 머티리얼이 재컴파일되므로
 * 점등 중에 수가 변하면 안 된다.
 */
export function resolveFloodlightSlotCount(
  lightCount: number,
  reserve: boolean,
  slotCap: number = FLOODLIGHT_SLOT_COUNT,
): number {
  const cap = Number.isFinite(slotCap) ? Math.max(0, Math.floor(slotCap)) : 0;
  if (reserve) return cap;
  const count = Number.isFinite(lightCount)
    ? Math.max(0, Math.floor(lightCount))
    : 0;
  return Math.min(cap, count);
}

/**
 * 투광등 → SpotLight 슬롯 배정. 조준점이 카메라 초점(시선과 지면의 교점,
 * lib/scene-shadow resolveShadowFocus)에 가까운 순으로 slotCount 개를 고른다.
 * 거리가 같으면 목록 순서다 — 같은 입력에 같은 답이라 초점이 멈추면 배정도
 * 멈춘다.
 *
 * @returns 슬롯 i 에 들어갈 조명의 인덱스. 길이 = min(slotCount, lights.length).
 */
export function assignFloodlightSlots(
  lights: readonly SavedFloodlightInfo[],
  focus: { x: number; z: number },
  slotCount: number,
): number[] {
  const count = Math.max(0, Math.min(Math.floor(slotCount), lights.length));
  if (count === 0) return [];
  if (count === lights.length) return lights.map((_, i) => i);
  const fx = Number.isFinite(focus.x) ? focus.x : 0;
  const fz = Number.isFinite(focus.z) ? focus.z : 0;
  const ranked = lights.map((light, index) => {
    const aim = floodlightAimPoint(light);
    const dx = aim[0] - fx;
    const dz = aim[2] - fz;
    return { index, d2: dx * dx + dz * dz };
  });
  ranked.sort((a, b) => a.d2 - b.d2 || a.index - b.index);
  return ranked.slice(0, count).map((r) => r.index);
}

/**
 * 초점 양자화 단위(씬 unit). 초점은 카메라가 조금만 돌아도 연속으로 변하는데
 * 그때마다 재배정하면 경계의 두 조명이 번갈아 켜진다. 격자에 맞추면 격자
 * 칸을 넘을 때만 바뀐다.
 */
/**
 * 평면도(직교 탑뷰)에서의 투광등 세기 배율. 위에서 본 빛 웅덩이는 큰 흰
 * 타원으로 도크를 덮어 정보를 가리므로 절반으로 줄인다 — 더 줄이면 밤의
 * 평면도 바닥이 다른 화면보다 검게 남는다(밤 바닥을 밝히는 것은 투광등뿐).
 * 세기만 곱하고 visible 은 건드리지 않는다(조명 수 변화 = 재컴파일).
 */
export const PLAN_VIEW_FLOODLIGHT_SCALE = 0.5;

export const FLOODLIGHT_FOCUS_STEP = 25;

export function quantizeFloodlightFocus(
  value: number,
  step: number = FLOODLIGHT_FOCUS_STEP,
): number {
  if (!Number.isFinite(value)) return 0;
  if (!(step > 0)) return value;
  return Math.round(value / step) * step;
}

/** 두 배정이 같은 조명 집합·순서인지. */
export function isSlotAssignmentEqual(
  a: readonly number[],
  b: readonly number[],
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}
