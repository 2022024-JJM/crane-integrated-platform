import { describe, expect, it } from 'vitest'
import {
  buildFactoryStatusSnapshot,
  pairOf,
  yardEquipmentOf,
  type TiltModuleStatus,
} from '../../../../shared/entities/equipment'
import { plannedIssueOf } from '../../../../shared/entities/equipment/statusMock'
import { lidarPairCell, meaningOfTilt, pairLinkOf, panelCell } from '../equipmentCells'
import { equipmentSummaryOf } from '../mapEntry'

/*
 * 라이다 칸은 짝 틸팅까지 대표한다 — 틸팅이 끊겼는데 칸이 '대기'로 서면, 야드 맵의 문제
 * BAY 목록(같은 이상 명단)과 현황 화면이 같은 설비를 두고 다른 말을 한다.
 */

const tilt = (over: Partial<TiltModuleStatus> = {}): TiltModuleStatus => ({
  id: 'PT-X',
  link: 'online',
  mode: 'idle',
  panDeg: 0,
  tiltDeg: 0,
  targetPanDeg: 0,
  targetTiltDeg: 0,
  atTarget: true,
  pairedLidarId: 'LD-X',
  motorAlarm: 0,
  lastMovedAt: 0,
  ...over,
})

describe('meaningOfTilt', () => {
  it('통신이 모드보다 먼저다 — 끊긴 틸팅은 대기여도 이상', () => {
    expect(meaningOfTilt(tilt({ link: 'offline' }))).toBe('warning')
    expect(meaningOfTilt(tilt({ link: 'error' }))).toBe('error')
  })

  it('통신이 살아 있으면 모드·모터 알람을 따른다', () => {
    expect(meaningOfTilt(tilt())).toBe('done')
    expect(meaningOfTilt(tilt({ mode: 'tilting' }))).toBe('inProgress')
    expect(meaningOfTilt(tilt({ motorAlarm: 101 }))).toBe('error')
  })
})

describe('pairLinkOf', () => {
  it('라이다와 짝 틸팅 중 더 나쁜 링크', () => {
    expect(pairLinkOf('online', tilt({ link: 'offline' }))).toBe('offline')
    expect(pairLinkOf('offline', tilt({ link: 'error' }))).toBe('error')
    expect(pairLinkOf('error', tilt({ link: 'offline' }))).toBe('error')
    expect(pairLinkOf('online', null)).toBe('online')
  })
})

describe('조립 현황 — 끊긴 짝 틸팅 (이상 명단의 PT-D21)', () => {
  const tiltModule = yardEquipmentOf('PT-D21')!
  const lidar = pairOf(tiltModule)!

  it('전제: 명단에서 PT-D21 은 끊김이고 짝 라이다는 정상이다', () => {
    expect(plannedIssueOf('PT-D21')).toBe('offline')
    expect(plannedIssueOf(lidar.id)).toBeNull()
  })

  it('라이다 칸이 틸팅 끊김을 대표 문구·틸팅 램프·칸 심각도로 말한다', () => {
    const snapshot = buildFactoryStatusSnapshot(tiltModule.factory, 0)
    const cell = lidarPairCell(lidar, snapshot, { freshText: '방금' })
    expect(cell.metric.text).toBe('틸팅 오프라인 · 방금')
    expect(cell.metric.meaning).toBe('warning')
    expect(cell.lamps.find((lamp) => lamp.label === '틸팅')).toMatchObject({
      meaning: 'warning',
      value: '오프라인',
    })
    expect(cell.severity).toBe('warning')
  })

  it('공장 요약의 이상 수에 그 칸이 든다 — 3DS 는 Edge PC 오류와 틸팅 끊김 둘', () => {
    expect(equipmentSummaryOf('3DS').issues).toBe(2)
  })
})

describe('캐비닛 칸 — 소속 설비가 빠진 것은 이상으로 세지 않는다', () => {
  const base = { id: 'PNL-X', typeId: 'PNL', powered: true, uplink: 'online' as const, lidarPairs: 6 }

  it('소속 하나가 끊겨도 캐비닛 자신이 멀쩡하면 정상 칸 (램프는 앰버로 수량을 말한다)', () => {
    const cell = panelCell({ ...base, memberOnline: 11, memberTotal: 12 })
    expect(cell.severity).toBe('done')
    expect(cell.lamps.find((lamp) => lamp.label === '소속')).toMatchObject({ meaning: 'warning', value: '11/12' })
  })

  it('캐비닛 자신의 업링크·전원 이상은 그대로 이상', () => {
    expect(panelCell({ ...base, uplink: 'error', memberOnline: 12, memberTotal: 12 }).severity).toBe('error')
    expect(panelCell({ ...base, powered: false, memberOnline: 12, memberTotal: 12 }).severity).toBe('error')
  })
})
