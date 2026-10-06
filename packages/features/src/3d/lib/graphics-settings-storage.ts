import { getStorageItem, setStorageItem } from '@crane/core/lib/safe-storage';

/**
 * 그래픽 설정의 localStorage 영속화 — 설정 페이지
 * (`@crane/widgets/detection-settings`)의 그래픽 카드가 바꾸는 값이다.
 * 씬 JSON 이 아니라 여기 두는 이유: 화면이 느린 것은 씬이 아니라 PC(GPU·
 * 모니터·윈도우 배율)의 사정이라, 씬에 넣으면 좋은 PC 까지 함께 흐려진다.
 * 키 관례는 `crane:<feature>`(detection-settings-storage 와 같은 계열),
 * 리전·씬과 무관한 브라우저 전역 설정이다.
 *
 * 스토어(model/use-scene-graphics-store)가 초기값을 `read` 로 잡고 setter
 * 마다 `write` 한다.
 */

export const GRAPHICS_SETTINGS_STORAGE_KEY = 'crane:graphics-settings';

/**
 * 고를 수 있는 해상도 배율. 픽셀 수는 배율의 제곱이라 차례로 전체·약 3/4·
 * 약 1/2·1/4 이다. 목록에 없는 값은 저장하지도 읽지도 않는다.
 */
export const RENDER_SCALE_OPTIONS = [1, 0.85, 0.7, 0.5] as const;

export type RenderScale = (typeof RENDER_SCALE_OPTIONS)[number];

export interface GraphicsSettings {
  /** 3D 캔버스 해상도 배율 — 적용은 lib/scene-dpr 의 resolveSceneDpr. */
  renderScale: RenderScale;
}

/** 배율 1 — 설정을 건드리지 않은 PC 는 지금까지와 같은 해상도로 그린다. */
export const GRAPHICS_SETTINGS_DEFAULTS: GraphicsSettings = {
  renderScale: 1,
};

export function isRenderScale(value: unknown): value is RenderScale {
  return (RENDER_SCALE_OPTIONS as readonly unknown[]).includes(value);
}

/** 표시용 백분율(정수). */
export function renderScalePercent(scale: RenderScale): number {
  return Math.round(scale * 100);
}

/** 목록의 배율만 받고 나머지는 기본값 — 봉투가 객체가 아니면 전부 기본값. */
export function sanitizeGraphicsSettings(raw: unknown): GraphicsSettings {
  const result = { ...GRAPHICS_SETTINGS_DEFAULTS };
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return result;
  }
  const renderScale = (raw as Record<string, unknown>).renderScale;
  if (isRenderScale(renderScale)) result.renderScale = renderScale;
  return result;
}

export function readGraphicsSettings(): GraphicsSettings {
  const raw = getStorageItem(GRAPHICS_SETTINGS_STORAGE_KEY);
  if (raw === null) return { ...GRAPHICS_SETTINGS_DEFAULTS };
  try {
    return sanitizeGraphicsSettings(JSON.parse(raw));
  } catch {
    return { ...GRAPHICS_SETTINGS_DEFAULTS };
  }
}

export function writeGraphicsSettings(patch: Partial<GraphicsSettings>): void {
  const next = sanitizeGraphicsSettings({
    ...readGraphicsSettings(),
    ...patch,
  });
  setStorageItem(GRAPHICS_SETTINGS_STORAGE_KEY, JSON.stringify(next));
}
