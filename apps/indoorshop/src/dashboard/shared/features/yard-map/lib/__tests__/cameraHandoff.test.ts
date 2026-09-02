import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearCameraHandoff,
  stashCameraHandoff,
  takeCameraHandoff,
} from '../cameraHandoff'
import type { YardView } from '../projection'

const VIEW: YardView = { centerLat: 34.87, centerLon: 128.7, scale: 90_000, pitch: 45, bearing: 12 }

/** 시각은 전부 주입 — 실시간에 기대지 않는 결정론 테스트 */
describe('cameraHandoff — 화면 간 카메라 승계 저장소', () => {
  beforeEach(clearCameraHandoff)

  it('stash 한 카메라를 take 가 그대로 돌려준다 (pitch·bearing 포함)', () => {
    stashCameraHandoff(VIEW, 1_000)
    expect(takeCameraHandoff(1_100)).toEqual(VIEW)
  })

  it('1회성 — 가져가면 비워진다 (허용 창 밖의 재호출은 null)', () => {
    stashCameraHandoff(VIEW, 1_000)
    expect(takeCameraHandoff(1_100)).toEqual(VIEW)
    expect(takeCameraHandoff(1_100 + 501)).toBeNull()
  })

  it('StrictMode 이중 렌더 허용 — take 직후(500ms 안)의 재호출은 같은 값을 본다', () => {
    stashCameraHandoff(VIEW, 1_000)
    expect(takeCameraHandoff(1_100)).toEqual(VIEW)
    expect(takeCameraHandoff(1_100 + 100)).toEqual(VIEW)
  })

  it('TTL 3초 — 지나면 null (새 탭·새로고침 폴백)', () => {
    stashCameraHandoff(VIEW, 1_000)
    expect(takeCameraHandoff(1_000 + 3_001)).toBeNull()
    // 만료된 슬롯은 비워져 재시도에도 나오지 않는다
    expect(takeCameraHandoff(1_000 + 3_002)).toBeNull()
  })

  it('stash 없이 take 는 null', () => {
    expect(takeCameraHandoff(1_000)).toBeNull()
  })

  it('나중 stash 가 이전 것을 덮는다 (1칸 저장소)', () => {
    stashCameraHandoff(VIEW, 1_000)
    const later: YardView = { ...VIEW, bearing: 90 }
    stashCameraHandoff(later, 1_200)
    expect(takeCameraHandoff(1_300)).toEqual(later)
  })

  it('복사 격리 — 돌려받은 객체를 고쳐도 저장소가 오염되지 않는다', () => {
    stashCameraHandoff(VIEW, 1_000)
    const first = takeCameraHandoff(1_100)
    if (first) first.bearing = 999
    expect(takeCameraHandoff(1_200)?.bearing).toBe(VIEW.bearing)
  })
})
