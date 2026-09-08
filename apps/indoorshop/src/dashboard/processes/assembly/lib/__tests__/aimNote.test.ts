import { describe, expect, it } from 'vitest'
import type { TiltModuleStatus } from '../../../../shared/entities/equipment'
import { aimNote } from '../equipmentCells'
import { SCAN_PERIOD_MS, mockDownSince, mockLastSignalAt, mockScanAt } from '../mapEntry'

/*
 * 셀이 **클릭 없이 말하는 것** (R13 완료 기준) — 다만 읽히는 말로.
 *
 * 예전 부기는 `-80°/-9°` 였다. 부호 붙은 숫자 두 개가 무엇의 값인지 말하지 않으니
 * 규칙을 이미 아는 사람에게만 읽혔다. 이름을 붙이는 데 드는 폭은 20px 남짓이다.
 */

function tilt(overrides: Partial<TiltModuleStatus> = {}): TiltModuleStatus {
  return {
    id: 'PT-P01',
    link: 'online',
    mode: 'idle',
    panDeg: -80,
    tiltDeg: -9,
    targetPanDeg: -80,
    targetTiltDeg: -9,
    atTarget: true,
    pairedLidarId: 'LD-P01',
    motorAlarm: 0,
    lastMovedAt: 0,
    ...overrides,
  }
}

describe('조준 부기 — 각도에 이름이 붙는다', () => {
  it('대기 상태에서도 pan·tilt 가 이름과 함께 선다', () => {
    expect(aimNote(tilt())).toBe('pan -80° · tilt -9°')
  })

  /* 늘 서는 줄이므로, 덧붙는 말은 이상할 때만 붙어야 눈에 띈다 */
  it('대기 중에는 모드를 덧붙이지 않는다 — 정상이 소음이 되지 않게', () => {
    expect(aimNote(tilt())).not.toContain('대기')
  })

  it('목표와 어긋나 있으면 목표가 함께 선다', () => {
    const note = aimNote(tilt({ mode: 'tilting', atTarget: false, targetPanDeg: -56, targetTiltDeg: 24 }))
    expect(note).toContain('pan -80° · tilt -9°')
    expect(note).toContain('→ -56°/24°')
  })

  /*
   * 목표 화살표가 이미 "움직이는 중"을 말한다 — 그 위에 '틸팅중'을 얹으면 같은 사실의
   * 되풀이고, 좁은 칸에서는 그 되풀이 때문에 진짜 값이 잘린다.
   */
  it('목표가 서 있으면 틸팅중은 겹쳐 적지 않는다', () => {
    const note = aimNote(tilt({ mode: 'tilting', atTarget: false, targetPanDeg: -56, targetTiltDeg: 24 }))
    expect(note).not.toContain('틸팅중')
  })

  it('목표에 닿은 채 틸팅중이면 그때는 낱말이 그 사실을 맡는다', () => {
    expect(aimNote(tilt({ mode: 'tilting', atTarget: true }))).toContain('틸팅중')
  })

  /* 색을 못 읽는 경로가 있다 — 사유는 늘 낱말로 남는다 */
  it('에러는 언제나 그 말이 붙는다', () => {
    expect(aimNote(tilt({ mode: 'error' }))).toContain('에러')
    expect(aimNote(tilt({ mode: 'error', atTarget: false }))).toContain('에러')
  })
})

/*
 * 신선도는 **에폭**이다.
 *
 * 예전에는 `13:02` 같은 고정된 벽시계를 적었다. 그 표기는 보는 사람에게 칸마다 지금
 * 시각과의 뺄셈을 시키고(`15:31` 과 `13:02` 이 똑같이 정상으로 보인다), 에폭이 없어
 * 그리드의 흐름·침묵 판정(R19)도 켜지지 않았다.
 */
describe('마지막 신호 시각 — 값이 실제로 흐른다', () => {
  const NOW = 1_756_000_000_000

  it('스캔은 주기마다 새로 선다 — 경과가 흐르고 새 값이 오면 깜빡인다', () => {
    const first = mockScanAt('LD-P01', NOW)
    expect(mockScanAt('LD-P01', NOW + 1_000)).toBe(first)
    expect(mockScanAt('LD-P01', NOW + SCAN_PERIOD_MS)).toBe(first + SCAN_PERIOD_MS)
  })

  it('스캔 시각은 늘 과거고, 한 주기보다 오래되지 않는다', () => {
    for (const id of ['LD-P01', 'LD-P17', 'LD-P99', 'PT-P03']) {
      const at = mockScanAt(id, NOW)
      expect(at).toBeLessThanOrEqual(NOW)
      expect(NOW - at).toBeLessThan(SCAN_PERIOD_MS)
    }
  })

  it('설비마다 위상이 다르다 — 337칸이 한꺼번에 깜빡이지 않는다', () => {
    const phases = new Set(['LD-P01', 'LD-P02', 'LD-P03', 'LD-P04'].map((id) => mockScanAt(id, NOW)))
    expect(phases.size).toBeGreaterThan(1)
  })

  /*
   * 끊긴 설비의 마지막 수신은 시 경계에 못 박는다 — `now` 에서 일정 시간을 빼는 방식이면
   * 렌더할 때마다 값이 되살아나 "5분째 끊김"이 영원히 5분이 된다.
   */
  it('끊긴 설비의 경과는 자라난다 — 매 렌더 되살아나지 않는다', () => {
    const at = mockDownSince('LD-P02', NOW)
    expect(mockDownSince('LD-P02', NOW + 600_000)).toBe(at)
    expect(NOW + 600_000 - at).toBeGreaterThan(NOW - at)
  })

  it('끊긴 시각은 5분 이상 과거다 — 갓 끊긴 것처럼 보이지 않는다', () => {
    for (const id of ['LD-P02', 'LD-P05', 'ED-P2']) {
      expect(NOW - mockDownSince(id, NOW)).toBeGreaterThanOrEqual(300_000)
    }
  })

  it('링크가 근거를 고른다 — 살아 있으면 마지막 스캔, 끊겼으면 끊기기 직전', () => {
    expect(mockLastSignalAt('LD-P01', 'online', NOW)).toBe(mockScanAt('LD-P01', NOW))
    expect(mockLastSignalAt('LD-P01', 'offline', NOW)).toBe(mockDownSince('LD-P01', NOW))
    expect(mockLastSignalAt('LD-P01', 'error', NOW)).toBe(mockDownSince('LD-P01', NOW))
  })
})
