/**
 * 화면 간 카메라 승계 — '/'(총괄)와 공정 맵 화면이 야드맵 카메라를 주고받는 1칸 저장소.
 *
 * 링크를 누르는 쪽이 떠나기 직전의 카메라를 `stash` 하고, 도착 화면이 첫 렌더에서
 * `take` 해 YardMap `initialView` 로 쓴다 — 전환 전후의 첫 프레임이 같아져 두 화면이
 * "같은 맵의 렌즈 교체"로 읽힌다 (W4-6a 설계 (a)안, D2 확정).
 *
 * 성질:
 *  - **TTL 3초** — 링크 클릭 → 다음 화면 마운트 사이만 산다. 새 탭·새로고침·북마크
 *    직접 진입은 자연히 무효가 되어 기존 동작(initialBounds)으로 폴백한다.
 *  - **1회성** — take 하면 비운다. 단 StrictMode 가 첫 렌더를 두 번 돌리므로,
 *    직후의 재호출(500ms 창)에는 같은 값을 돌려준다 — 같은 화면의 이중 렌더가
 *    승계를 잃지 않게 하는 허용이지, 두 번째 화면 전환까지 살리는 게 아니다.
 *  - URL·히스토리를 건드리지 않는다 (`location.state` 를 쓰지 않는 이유 — 뒤로가기
 *    히스토리에 낡은 카메라가 남는 부작용을 피한다).
 */
import type { YardView } from './projection'

const TTL_MS = 3_000
/** StrictMode 이중 렌더 허용 창 — 이 안의 연속 take 는 같은 값을 본다 */
const REREAD_MS = 500

let slot: { view: YardView; at: number } | null = null
let lastTaken: { view: YardView; at: number } | null = null

/** 떠나는 화면이 링크 클릭 시점의 카메라를 맡긴다 */
export function stashCameraHandoff(view: YardView, now: number = Date.now()): void {
  slot = { view: { ...view }, at: now }
}

/**
 * 도착 화면이 맡겨진 카메라를 가져간다 — TTL 안이면 값, 아니면 null.
 * 가져가면 비워진다(1회성 — REREAD_MS 창의 재호출만 예외).
 */
export function takeCameraHandoff(now: number = Date.now()): YardView | null {
  if (slot) {
    const { view, at } = slot
    slot = null
    if (now - at <= TTL_MS) {
      lastTaken = { view, at: now }
      return { ...view }
    }
  }
  if (lastTaken && now - lastTaken.at <= REREAD_MS) return { ...lastTaken.view }
  return null
}

/** 테스트 격리용 — 앱 코드는 부르지 않는다 */
export function clearCameraHandoff(): void {
  slot = null
  lastTaken = null
}
