import { describe, expect, it } from 'vitest'
import {
  EQUIPMENT_PANELS,
  YARD_EQUIPMENT,
  buildEquipmentStatusSnapshot,
  buildFactoryStatusSnapshot,
  edgePcStatusIn,
  equipmentIdsOfFactory,
  equipmentLinkOf,
  fetchEquipmentStatuses,
  fetchFactoryEquipmentStatuses,
  linkIn,
  mockEdgePcStatus,
  mockPanelStatus,
  mockTiltStatus,
  panelStatusIn,
  tiltStatusIn,
  EMPTY_EQUIPMENT_STATUS,
} from '..'

/**
 * 설비 상태의 **공식 계약**(statusApi) — 화면이 mock 함수 대신 부르는 문.
 *
 * 지키는 것 세 가지: (1) 스냅샷의 값이 기존 mock 과 **한 치도 다르지 않다** — 계약을
 * 끼워 넣으면서 값이 변하면 화면 회귀를 눈으로 찾아야 한다. (2) 없는 ID 를 지어내지
 * 않는다. (3) 링크 축이 파생 규칙(`equipmentLinkOf`)과 갈리지 않는다.
 */
const NOW = 1_756_000_000_000

describe('스냅샷 빌더', () => {
  it('Edge PC·틸팅·캐비닛 상태가 기존 mock 과 정확히 같다 — 계약이 값을 바꾸지 않는다', () => {
    const snapshot = buildFactoryStatusSnapshot('PBS', NOW)
    for (const e of YARD_EQUIPMENT.filter((x) => x.factory === 'PBS')) {
      if (e.typeId === 'EDGE')
        expect(edgePcStatusIn(snapshot, e.id)).toEqual(mockEdgePcStatus(e, NOW))
      if (e.typeId === 'TILT')
        expect(tiltStatusIn(snapshot, e.id)).toEqual(mockTiltStatus(e, NOW))
    }
    for (const p of EQUIPMENT_PANELS.filter((x) => x.factory === 'PBS')) {
      expect(panelStatusIn(snapshot, p.id)).toEqual(mockPanelStatus(p, NOW))
    }
  })

  it('링크 축이 파생 규칙과 같다 — 지도 마커와 스냅샷이 같은 설비에 같은 답을 한다', () => {
    const snapshot = buildFactoryStatusSnapshot('PBS', NOW)
    for (const e of YARD_EQUIPMENT.filter((x) => x.factory === 'PBS')) {
      expect(snapshot.link.get(e.id)).toBe(equipmentLinkOf(e))
    }
  })

  it('요청한 설비만 담고, 모르는 ID 는 조용히 빠진다 — 지어내지 않는다', () => {
    const ids = [...equipmentIdsOfFactory('PBS').slice(0, 3), '없는설비']
    const snapshot = buildEquipmentStatusSnapshot(ids, NOW)
    expect(snapshot.ids).toEqual(ids.slice(0, 3))
    expect(snapshot.link.has('없는설비')).toBe(false)
    expect(linkIn(snapshot, '없는설비')).toBeNull()
  })

  it('기준 시각이 스냅샷에 실린다 — 화면의 "갱신됨" 표기의 근거', () => {
    expect(buildEquipmentStatusSnapshot([], NOW).at).toBe(NOW)
  })

  it('같은 시각이면 같은 답 — 결정론(폴링해도 렌더마다 흔들리지 않는다)', () => {
    expect(buildFactoryStatusSnapshot('PBS', NOW)).toEqual(buildFactoryStatusSnapshot('PBS', NOW))
  })
})

describe('공식 계약 (fetch*)', () => {
  it('비동기 문이 동기 빌더와 같은 답을 낸다 — 실연동 전의 mock 드라이버', async () => {
    const ids = equipmentIdsOfFactory('PBS')
    expect(await fetchEquipmentStatuses(ids, NOW)).toEqual(buildEquipmentStatusSnapshot(ids, NOW))
    expect(await fetchFactoryEquipmentStatuses('PBS', NOW)).toEqual(
      buildFactoryStatusSnapshot('PBS', NOW)
    )
  })
})

describe('스냅샷 읽기', () => {
  it('빈 스냅샷의 링크는 파생 규칙으로 되짚는다 — 링크는 규칙이라 기다릴 이유가 없다', () => {
    const e = YARD_EQUIPMENT[0]
    expect(linkIn(EMPTY_EQUIPMENT_STATUS, e.id)).toBe(equipmentLinkOf(e))
  })

  it('원천 값(자원·각도)은 되짚지 않는다 — 빈 스냅샷에서는 null', () => {
    const edge = YARD_EQUIPMENT.find((e) => e.typeId === 'EDGE')!
    const tilt = YARD_EQUIPMENT.find((e) => e.typeId === 'TILT')!
    expect(edgePcStatusIn(EMPTY_EQUIPMENT_STATUS, edge.id)).toBeNull()
    expect(tiltStatusIn(EMPTY_EQUIPMENT_STATUS, tilt.id)).toBeNull()
  })
})
