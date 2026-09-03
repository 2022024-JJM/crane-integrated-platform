import { describe, expect, it } from 'vitest'
import {
  EQUIPMENT_PANELS,
  YARD_EQUIPMENT,
  buildEquipmentStatusSnapshot,
  equipmentLinkOf,
  mockEdgePcStatus,
  mockTiltStatus,
  mockPanelStatus,
} from '../../../entities/equipment'
import { blocksInZone } from '../../../entities/vessel'
import { generateAssyUnits } from '../../performance/api/performanceApi'
import {
  COLLECTION_GAP_THRESHOLD_MINUTES,
  daysBetween,
  deriveCollectionGapAlarms,
  deriveEquipmentAlarms,
  deriveMismatchAlarms,
  derivePaintingBatchAlarm,
} from '../model/derive'
import { byRailSeverityThenTime } from '../model/types'

/**
 * 알람 판정 규칙 (W7-1) — 원천별로 잠근다.
 *
 * 알람은 판정 결과라 별도 mock 이 없다 — 여기서도 실제 원천(로스터×매칭 캐스케이드,
 * 설비 상태 스냅샷)을 그대로 먹여, 알람이 화면 어딘가에 실제로 서 있는 사정만
 * 가리키는지 확인한다.
 */
const BASE_DATE = '2026-09-03'
const NOW = 1_756_000_000_000

/* ── 1. 매칭 불일치 ── */
describe('deriveMismatchAlarms', () => {
  const blocks = blocksInZone('assembly').map((block) => ({
    projNo: block.projNo,
    blockNo: block.blockNo,
    assys: generateAssyUnits(block.projNo, block.blockNo, BASE_DATE).assys,
  }))
  const alarms = deriveMismatchAlarms(blocks, BASE_DATE)

  it('불일치(unmatched) ASSY 한 개가 알람 한 줄이다 — 뭉치지도 지어내지도 않는다', () => {
    const expected = blocks.flatMap((b) => b.assys.filter((a) => a.match.state === 'unmatched'))
    expect(alarms).toHaveLength(expected.length)
    expect(alarms.length).toBeGreaterThan(0) /* 로스터에 불일치 시나리오가 실존한다 */
    expect(new Set(alarms.map((a) => a.id)).size).toBe(alarms.length)
  })

  it('matched·fallback 은 알람이 아니다', () => {
    const ids = new Set(alarms.map((a) => a.source))
    for (const block of blocks) {
      for (const assy of block.assys) {
        if (assy.match.state !== 'unmatched') expect(ids.has(assy.assyNo)).toBe(false)
      }
    }
  })

  it('딥링크가 통합실적의 기존 계약(?vessel=&block=&assy=)이다', () => {
    const withUnmatched = blocks.find((b) => b.assys.some((a) => a.match.state === 'unmatched'))!
    const assy = withUnmatched.assys.find((a) => a.match.state === 'unmatched')!
    const alarm = alarms.find((a) => a.source === assy.assyNo)!
    expect(alarm.href).toBe(
      `/performance?vessel=${withUnmatched.projNo}&block=${withUnmatched.blockNo}&assy=${assy.assyNo}`
    )
    expect(alarm.severity).toBe('warning')
    expect(alarm.kind).toBe('mismatch')
  })

  it('같은 원천이면 같은 id — dismiss 가 재계산을 견딘다', () => {
    expect(deriveMismatchAlarms(blocks, BASE_DATE).map((a) => a.id)).toEqual(
      alarms.map((a) => a.id)
    )
  })
})

/* ── 2. 설비 이상 ── */
describe('deriveEquipmentAlarms', () => {
  const snapshot = buildEquipmentStatusSnapshot(
    YARD_EQUIPMENT.map((e) => e.id),
    NOW
  )
  const alarms = deriveEquipmentAlarms(snapshot, () => null)
  const byId = new Map(alarms.map((a) => [a.source, a]))

  it('에러 모드 틸팅 전량이 critical 로 선다 (모터 알람 코드 포함)', () => {
    for (const e of YARD_EQUIPMENT.filter((x) => x.typeId === 'TILT')) {
      const status = mockTiltStatus(e, NOW)
      const alarm = byId.get(e.id)
      if (status.mode === 'error') {
        expect(alarm?.severity).toBe('critical')
        expect(alarm?.messageParams?.code).toBe(status.motorAlarm)
      } else {
        expect(alarm, e.id).toBeUndefined()
      }
    }
  })

  it('Edge PC — 수집 서비스 중단·링크 오류는 critical, 오프라인은 warning, 정상은 없음', () => {
    for (const e of YARD_EQUIPMENT.filter((x) => x.typeId === 'EDGE')) {
      const status = mockEdgePcStatus(e, NOW)
      const alarm = byId.get(e.id)
      if (status.collector === 'exited' || status.link === 'error') {
        expect(alarm?.severity).toBe('critical')
      } else if (status.link === 'offline') {
        expect(alarm?.severity).toBe('warning')
      } else {
        expect(alarm, e.id).toBeUndefined()
      }
    }
  })

  it('정지 캐비닛은 critical — 소속 대수가 문구에 실린다', () => {
    for (const panel of EQUIPMENT_PANELS.filter((p) => p.kind === 'network-panel')) {
      const status = mockPanelStatus(panel, NOW)
      const alarm = byId.get(panel.id)
      if (status.health === 'down') {
        expect(alarm?.severity).toBe('critical')
        expect(alarm?.messageParams?.count).toBe(status.memberTotal)
      } else if (status.uplink === 'error') {
        expect(alarm?.severity).toBe('warning')
      }
    }
  })

  it('라이다는 응답 오류만 warning — 오프라인은 배경 소음이라 세우지 않는다', () => {
    for (const e of YARD_EQUIPMENT.filter((x) => x.typeId === 'LIDAR')) {
      const link = equipmentLinkOf(e)
      const alarm = byId.get(e.id)
      if (link === 'error') expect(alarm?.severity).toBe('warning')
      else expect(alarm, e.id).toBeUndefined()
    }
  })

  it('설비 한 대에 알람은 최대 한 줄이다', () => {
    expect(new Set(alarms.map((a) => a.source)).size).toBe(alarms.length)
  })

  it('딥링크 해석기가 주는 경로를 그대로 싣는다 — 모르는 공장은 null(링크 없는 알람)', () => {
    const linked = deriveEquipmentAlarms(snapshot, (e) => `/zones/test?factory=${e.factory}`)
    for (const alarm of linked) expect(alarm.href).toMatch(/^\/zones\/test\?factory=/)
  })
})

/* ── 3-a. 도장 일일 배치 ── */
describe('derivePaintingBatchAlarm', () => {
  it('최신 실적일이 어제(D+1)면 정상 — 등록은 하루 1회 일괄이다', () => {
    expect(derivePaintingBatchAlarm({ baseDate: BASE_DATE, latestActlDate: '2026-09-02' })).toBeNull()
    expect(derivePaintingBatchAlarm({ baseDate: BASE_DATE, latestActlDate: BASE_DATE })).toBeNull()
  })

  it('D+2 는 warning, D+3 부터 critical — 문구에 지연 일수가 실린다', () => {
    const d2 = derivePaintingBatchAlarm({ baseDate: BASE_DATE, latestActlDate: '2026-09-01' })
    expect(d2?.severity).toBe('warning')
    expect(d2?.titleParams?.lag).toBe(2)
    const d4 = derivePaintingBatchAlarm({ baseDate: BASE_DATE, latestActlDate: '2026-08-30' })
    expect(d4?.severity).toBe('critical')
    expect(d4?.titleParams?.lag).toBe(4)
    expect(d4?.href).toBe('/performance')
  })

  it('등록분이 아예 없으면 알람이 아니다 — 근거 없는 판정을 지어내지 않는다', () => {
    expect(derivePaintingBatchAlarm({ baseDate: BASE_DATE, latestActlDate: null })).toBeNull()
  })

  it('daysBetween — 날짜 문자열 차이 계산이 판정의 근거다', () => {
    expect(daysBetween('2026-09-03', '2026-09-01')).toBe(2)
    expect(daysBetween('2026-09-03', '2026-09-03')).toBe(0)
    expect(daysBetween('2026-10-01', '2026-09-30')).toBe(1) /* 월 경계 */
  })
})

/* ── 3-b. 수집 이벤트 공백 ── */
describe('deriveCollectionGapAlarms', () => {
  const NOW_ISO = '2026-09-03T18:00:00.000Z'

  it('임계 안이면 조용하다', () => {
    const alarms = deriveCollectionGapAlarms(
      [{ zone: 'assembly', minutesSinceLast: COLLECTION_GAP_THRESHOLD_MINUTES - 1, lastLabel: '14:00', href: '/zones/assembly' }],
      { nowIso: NOW_ISO }
    )
    expect(alarms).toEqual([])
  })

  it('임계를 넘으면 warning — 공정 화면으로 나가는 문이 실린다', () => {
    const alarms = deriveCollectionGapAlarms(
      [{ zone: 'assembly', minutesSinceLast: COLLECTION_GAP_THRESHOLD_MINUTES, lastLabel: '09:00', href: '/zones/assembly' }],
      { nowIso: NOW_ISO }
    )
    expect(alarms).toHaveLength(1)
    expect(alarms[0].severity).toBe('warning')
    expect(alarms[0].id).toBe('gap:assembly')
    expect(alarms[0].href).toBe('/zones/assembly')
  })

  it('수집 이력이 없으면 공백이 아니다 — 근거 없는 판정을 지어내지 않는다', () => {
    const alarms = deriveCollectionGapAlarms(
      [{ zone: 'outfitting', minutesSinceLast: null, lastLabel: null, href: null }],
      { nowIso: NOW_ISO }
    )
    expect(alarms).toEqual([])
  })
})

/* ── 정렬 ── */
describe('byRailSeverityThenTime', () => {
  it('심각도 먼저, 같은 심각도는 최신 먼저', () => {
    const snapshot = buildEquipmentStatusSnapshot(YARD_EQUIPMENT.map((e) => e.id), NOW)
    const sorted = [...deriveEquipmentAlarms(snapshot, () => null)].sort(byRailSeverityThenTime)
    let seenWarning = false
    for (const alarm of sorted) {
      if (alarm.severity === 'warning') seenWarning = true
      if (seenWarning) expect(alarm.severity).toBe('warning')
    }
  })
})
