import { getStorageJson, setStorageJson } from '@crane/core/lib/safe-storage';

/**
 * 기즈모 스냅 단위(이동·회전·크기)와 그 영속화.
 *
 * 단위 값은 three TransformControls 의 `translationSnap` / `rotationSnap` /
 * `scaleSnap` 에 그대로 들어간다 — rotation 은 라디안이다. 스냅 on/off 는
 * 세션 전용(use-scene-editor-view-store)이지만 고른 단위는 사용자 선호라
 * 독 고정(dock-storage)과 같은 `crane:<feature>:<scope>` 키로 localStorage
 * 에 남긴다. 리전과 무관한 전역 설정이다.
 *
 * 바닥 격자(ground-grid-material)의 셀은 기본 이동 스냅(1m)에 맞춰져 있고
 * 사용자가 단위를 바꿔도 따라가지 않는다 — 0.1m 격자는 대형 지도에서
 * 무아레가 생긴다.
 */

export const SNAP_STEP_STORAGE_KEY = 'crane:scene-editor:snap-step';

export type SceneSnapChannel = 'translation' | 'rotation' | 'scale';
export type SceneSnapStep = Readonly<Record<SceneSnapChannel, number>>;

export const SCENE_SNAP_CHANNELS: readonly SceneSnapChannel[] = [
  'translation',
  'rotation',
  'scale',
];

const DEG = Math.PI / 180;

/** 드롭다운이 제공하는 단위 후보. 저장값도 이 목록 안에 있어야 한다. */
export const SCENE_SNAP_STEP_OPTIONS: Readonly<
  Record<SceneSnapChannel, readonly number[]>
> = {
  translation: [0.1, 0.25, 1],
  rotation: [5 * DEG, 15 * DEG, 45 * DEG],
  scale: [0.1, 0.25],
};

/** 기본 스냅 단위 — 1m · 15° · 0.1. 저장값이 없거나 손상됐을 때의 폴백. */
export const SCENE_TRANSFORM_SNAP: SceneSnapStep = {
  translation: 1,
  rotation: 15 * DEG,
  scale: 0.1,
};

// 라디안은 부동소수라 JSON 왕복 후에도 동일하지만, 손으로 고친 저장값이나
// 다른 계산 경로에서 온 값도 같은 단위로 인정하도록 오차를 둔다.
const EPSILON = 1e-9;

export function isSnapStepOption(
  channel: SceneSnapChannel,
  value: unknown,
): value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return false;
  }
  return SCENE_SNAP_STEP_OPTIONS[channel].some(
    (option) => Math.abs(option - value) < EPSILON,
  );
}

/**
 * 저장값을 채널별로 검사해 목록에 없는 값·타입 오염·결손은 기본값으로
 * 되돌린다. 부분 손상이라도 멀쩡한 채널은 살린다.
 */
export function sanitizeSnapStep(raw: unknown): SceneSnapStep {
  const source =
    raw !== null && typeof raw === 'object'
      ? (raw as Record<string, unknown>)
      : {};
  const step: Record<SceneSnapChannel, number> = { ...SCENE_TRANSFORM_SNAP };
  for (const channel of SCENE_SNAP_CHANNELS) {
    const value = source[channel];
    if (isSnapStepOption(channel, value)) {
      // 목록의 정규 값으로 치환해 부동소수 오차가 저장본에 누적되지 않게 한다.
      step[channel] = SCENE_SNAP_STEP_OPTIONS[channel].find(
        (option) => Math.abs(option - value) < EPSILON,
      )!;
    }
  }
  return step;
}

export function readSnapStep(): SceneSnapStep {
  return sanitizeSnapStep(getStorageJson(SNAP_STEP_STORAGE_KEY));
}

export function writeSnapStep(step: SceneSnapStep): void {
  setStorageJson(SNAP_STEP_STORAGE_KEY, step);
}
