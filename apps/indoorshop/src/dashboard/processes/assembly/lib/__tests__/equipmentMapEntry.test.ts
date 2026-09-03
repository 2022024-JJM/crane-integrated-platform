import { describe, expect, it } from 'vitest'
import {
  EQUIPMENT_PANELS,
  buildFactoryStatusSnapshot,
} from '../../../../shared/entities/equipment'
import {
  assemblyMapFactoryNames,
  edgePcsOf,
  equipmentCountsOf,
  equipmentState,
  panelsWithStatus,
  tiltModeCounts,
  tiltOfLidar,
  tiltsOf,
} from '../mapEntry'
import { YARD_EQUIPMENT } from '../../../../shared/entities/equipment'

/**
 * 조립 맵 진입이 쓰는 **설비 파생 계산**.
 *
 * 화면이 그리는 값(마커·목록)이 실데이터에서 어긋나지 않는지 지킨다 — 마커 수가 설비
 * 대수와 다르거나, 종류 심볼/색이 레지스트리 밖에서 지어지거나, 캐비닛 목록이 다른
 * 공장 것을 섞어 오면 화면은 조용히 틀린 그림을 그린다.
 */
const NOW = 1_756_000_000_000
const FACTORIES = assemblyMapFactoryNames()
/* 상태는 이제 **스냅샷으로 주입**한다 — 파생 계산은 원천을 직접 부르지 않는다.
   동기 빌더를 쓰는 것은 의도한 것이다: 규칙 검증에 Promise 를 끼울 이유가 없다. */
const snapOf = (factory: string) => buildFactoryStatusSnapshot(factory, NOW)

describe('공장별 설비 인벤토리', () => {
  it('종류별 대수가 설비 엔티티와 일치한다', () => {
    const counts = equipmentCountsOf('PBS')
    const expected: Record<string, number> = {}
    for (const e of YARD_EQUIPMENT) {
      if (e.factory !== 'PBS') continue
      expected[e.typeId] = (expected[e.typeId] ?? 0) + 1
    }
    expect(counts).toEqual(expected)
  })

  it('캐비닛 목록은 그 공장 것만·소속 설비도 같은 공장', () => {
    const entries = panelsWithStatus('PBS', snapOf('PBS'))
    expect(entries.length).toBe(EQUIPMENT_PANELS.filter((p) => p.factory === 'PBS').length)
    for (const { panel, status, members } of entries) {
      expect(panel.factory).toBe('PBS')
      expect(members.every((m) => m.factory === 'PBS')).toBe(true)
      expect(status.memberTotal).toBe(members.length)
    }
  })

  it('Edge PC 목록은 EDGE 종류만 낸다', () => {
    for (const f of FACTORIES) {
      for (const { equipment } of edgePcsOf(f, snapOf(f))) {
        expect(equipment.typeId).toBe('EDGE')
        expect(equipment.factory).toBe(f)
      }
    }
  })

  it('라이다에서 페어 틸팅 상태를 되짚는다', () => {
    const lidar = YARD_EQUIPMENT.find((e) => e.typeId === 'LIDAR')!
    const snapshot = snapOf(lidar.factory)
    const tilt = tiltOfLidar(lidar.id, snapshot)
    expect(tilt?.pairedLidarId).toBe(lidar.id)
    expect(tiltOfLidar('없는설비', snapshot)).toBeNull()
  })
})

describe('틸팅 개별 상태 (③설비 단)', () => {
  it('공장의 틸팅 전량에 상태가 나오고 ID 순으로 선다', () => {
    const tilts = tiltsOf('PBS', snapOf('PBS'))
    const expected = YARD_EQUIPMENT.filter((e) => e.typeId === 'TILT' && e.factory === 'PBS')
    expect(tilts).toHaveLength(expected.length)
    expect(tilts.map((t) => t.equipment.id)).toEqual(
      [...tilts.map((t) => t.equipment.id)].sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true })
      )
    )
  })

  it('각 틸팅이 페어 라이다를 안다 — 상태만 보고도 어느 라이다인지 짚힌다', () => {
    for (const { equipment, status } of tiltsOf('PBS', snapOf('PBS'))) {
      expect(status.pairedLidarId).toBe(`LD-${equipment.id.slice(3)}`)
    }
  })

  it('모드별 대수 합이 틸팅 대수와 같다 — 접힌 줄의 요약이 목록과 어긋나지 않는다', () => {
    const tilts = tiltsOf('PBS', snapOf('PBS'))
    const counts = tiltModeCounts(tilts)
    expect(counts.idle + counts.tilting + counts.error).toBe(tilts.length)
  })

  it('에러 모드에는 모터 알람이 실린다 (이상 테두리의 근거)', () => {
    for (const { status } of tiltsOf('GBS', snapOf('GBS'))) {
      if (status.mode === 'error') expect(status.motorAlarm).toBeGreaterThan(0)
      else expect(status.motorAlarm).toBe(0)
    }
  })

  it('틸팅의 통신 축은 마커 상태와 같다 — 지도와 목록이 갈리지 않는다', () => {
    for (const { equipment, status } of tiltsOf('PBS', snapOf('PBS'))) {
      expect(status.link).toBe(equipmentState(equipment))
    }
  })
})
