import { getStorageItem, setStorageItem } from '@crane/core/lib/safe-storage';

/**
 * 감지 설정(충돌·영역)의 localStorage 영속화 — 감지 설정 페이지
 * (`@crane/widgets/detection-settings`)가 한 곳에서 관리하는 다섯 값이다.
 * 2026-09-17 이전엔 두 스토어가 세션 전용이라 새로고침마다 전부 ON 으로
 * 돌아갔다. 키 관례는 `crane:<feature>` (alert-notifications 와 같은 계열),
 * 리전·씬과 무관한 브라우저 전역 설정이다.
 *
 * 스토어(use-scene-collision-store, use-scene-zone-store)가 초기값을 `read`
 * 로 잡고 setter 마다 `write` 한다. 두 스토어가 같은 봉투를 나눠 쓰므로
 * `write` 는 read → merge → write 라 서로의 필드를 덮지 않는다.
 */

export const DETECTION_SETTINGS_STORAGE_KEY = 'crane:detection-settings';

export interface DetectionSettings {
  /** 충돌 감지 on/off. */
  collisionEnabled: boolean;
  /** 충돌 시 정지(시뮬레이션·플레이백만 — 실시간은 정지하지 않는다). */
  pauseOnCollision: boolean;
  /** 영역 침범 감지 on/off. */
  zoneEnabled: boolean;
  /** 영역 이름 배지 표시. */
  zoneLabelsVisible: boolean;
  /** 'stop' 영역 침범 시 정지(시뮬레이션·플레이백만). */
  stopOnIntrusion: boolean;
}

/**
 * 감지·표시는 ON(관제자가 매번 켜지 않아도 되게), 정지 둘은 OFF(2026-09-18 —
 * 기본으로 재생을 멈추면 시뮬레이션·플레이백이 첫 충돌·침범에서 서 버린다.
 * 필요한 사람이 설정 페이지에서 켠다).
 */
export const DETECTION_SETTINGS_DEFAULTS: DetectionSettings = {
  collisionEnabled: true,
  pauseOnCollision: false,
  zoneEnabled: true,
  zoneLabelsVisible: true,
  stopOnIntrusion: false,
};

const FIELDS = Object.keys(
  DETECTION_SETTINGS_DEFAULTS,
) as (keyof DetectionSettings)[];

/** 필드별로 boolean 만 받고 나머지는 기본값 — 봉투가 객체가 아니면 전부 기본값. */
export function sanitizeDetectionSettings(raw: unknown): DetectionSettings {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ...DETECTION_SETTINGS_DEFAULTS };
  }
  const source = raw as Record<string, unknown>;
  const result = { ...DETECTION_SETTINGS_DEFAULTS };
  for (const field of FIELDS) {
    const value = source[field];
    if (typeof value === 'boolean') result[field] = value;
  }
  return result;
}

export function readDetectionSettings(): DetectionSettings {
  const raw = getStorageItem(DETECTION_SETTINGS_STORAGE_KEY);
  if (raw === null) return { ...DETECTION_SETTINGS_DEFAULTS };
  try {
    return sanitizeDetectionSettings(JSON.parse(raw));
  } catch {
    return { ...DETECTION_SETTINGS_DEFAULTS };
  }
}

export function writeDetectionSettings(
  patch: Partial<DetectionSettings>,
): void {
  const next = sanitizeDetectionSettings({
    ...readDetectionSettings(),
    ...patch,
  });
  setStorageItem(DETECTION_SETTINGS_STORAGE_KEY, JSON.stringify(next));
}
