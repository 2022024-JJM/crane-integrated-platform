/*
 * 저사양 렌더 품질 모드 (PRD FR-4).
 *
 * 현장 단말의 GPU 사양이 확정되지 않아(오픈 이슈 7) 자동 판별 대신 사용자가 켜는
 * 스위치로 둔다. 켜면 픽셀 밀도를 1로 눌러 렌더 부하를 줄인다 — 그림자·후처리는
 * 애초에 쓰지 않으므로 여기서 끌 것이 없다.
 *
 * 값은 localStorage 에 남아 다음 방문에도 유지되고, 같은 문서 안의 뷰어들은
 * CustomEvent 로 즉시 따라온다.
 */

const STORAGE_KEY = 'assembly-viewer-low-gpu'
const CHANGE_EVENT = 'assembly-viewer-quality-change'

export function isLowGpuMode(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function setLowGpuMode(on: boolean): void {
  try {
    if (on) localStorage.setItem(STORAGE_KEY, '1')
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // 저장 실패해도 이 세션의 뷰어에는 반영한다
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: on }))
}

export function subscribeQualityMode(listener: (low: boolean) => void): () => void {
  const handler = (event: Event) => listener(Boolean((event as CustomEvent).detail))
  window.addEventListener(CHANGE_EVENT, handler)
  return () => window.removeEventListener(CHANGE_EVENT, handler)
}

/**
 * 이 모드에서 렌더러에 줄 픽셀 밀도.
 *
 * 위(기본)에는 **상한이 있다.** `devicePixelRatio` 를 그대로 쓰면 3x·4x 화면에서
 * 그리는 픽셀이 2.25~4배로 뛴다 — 공장 뷰는 한 장에 점 27만·삼각형 18만을 채우는
 * 장면이라, 그 배수가 곧 프레임 시간이 된다. 2 를 넘겨 얻는 선명함은 이 장면(점군·
 * 얇은 윤곽선)에서는 눈에 잘 띄지 않는 반면 부하는 정직하게 는다.
 *
 * 2x 화면(대부분의 현장 노트북·맥)에서는 값이 그대로이므로 보이는 것은 달라지지 않는다.
 * 더 눌러야 하면 저사양 모드가 1 로 내린다.
 */
const MAX_PIXEL_RATIO = 2

export function pixelRatioFor(low: boolean): number {
  return low ? 1 : Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO)
}
