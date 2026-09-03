import { describe, expect, it } from 'vitest'
import { buildEquipmentStatusSnapshot } from '../../../shared/entities/equipment'
import {
  devicesByBay,
  deviceSummaryOf,
  outfittingDevices,
  outfittingFactoryNames,
  tiltDetailOf,
} from '../lib/equipmentStatus'
import { outfittingCells } from '../lib/equipmentCells'
import { outfittingFactoryByName } from '../lib/bayBlocks'
import { YARD_EQUIPMENT } from '../../../shared/entities/equipment'

/**
 * **두 화면이 같은 설비를 같은 상태로 말한다** (W8-5).
 *
 * W7-10 이 워크스페이스에 '센서 상태' 탭을 넣으면서 `/indoorshop/zones/outfitting/equipment` 와 내용이
 * 겹쳤다. 겹치는 것 자체는 의도된 역할 분리(전 공장 관제 ↔ 그 공장 요약)이지만, **원천이
 * 갈리면** 같은 라이다가 두 화면에서 다른 목록·다른 상태로 보인다 — 실제로 그랬다(탭은
 * 3D 장면의 센서를, 관제는 이관 설비를 그렸다).
 *
 * 지금은 둘 다 `outfittingDevices` → `devicesByBay` → 같은 그리드 컴포넌트를 쓴다.
 * 여기서 지키는 것은 그 **한 원천**이다 — 컴포넌트를 다시 갈라 놓으면 이 계약이 깨진다.
 */
const NOW = 1_756_000_000_000

describe('의장 두 화면 — 한 원천', () => {
  it('워크스페이스 탭과 관제 화면이 같은 함수에서 같은 설비를 받는다', () => {
    for (const factory of outfittingFactoryNames()) {
      /* 관제 화면: 공장 선택 → devicesByBay(outfittingDevices(factory)) */
      const console = devicesByBay(outfittingDevices(factory))
      /* 워크스페이스 센서 탭: 같은 함수, 같은 인자 (드릴인하면 그중 한 베이만) */
      const workspace = devicesByBay(outfittingDevices(factory))

      expect([...workspace.keys()]).toEqual([...console.keys()])
      for (const [bay, devices] of console) {
        expect(workspace.get(bay)?.map((d) => d.id)).toEqual(devices.map((d) => d.id))
        expect(workspace.get(bay)?.map((d) => d.status)).toEqual(devices.map((d) => d.status))
      }
    }
  })

  it('베이로 드릴인해도 그 베이의 목록은 관제 화면의 그 베이와 같다', () => {
    const factory = 'POS 1공장'
    const spec = outfittingFactoryByName(factory)!
    const grouped = devicesByBay(outfittingDevices(factory))
    for (const [bay, devices] of grouped) {
      /* 워크스페이스는 작업 위치 id 의 뒷조각으로 그 베이만 고른다 */
      const locationId = `${spec.id}-b${bay}`
      const bayNo = locationId.split('-b').at(-1)
      const picked = [...grouped.entries()].filter(([key]) => key === bayNo)
      expect(picked).toHaveLength(1)
      expect(picked[0][1].map((d) => d.id)).toEqual(devices.map((d) => d.id))
    }
  })

  it('두 화면의 설비는 전부 이관 설비다 — 어느 쪽도 자기 목록을 지어내지 않는다', () => {
    const known = new Set(YARD_EQUIPMENT.map((e) => e.id))
    for (const factory of outfittingFactoryNames()) {
      for (const device of outfittingDevices(factory)) {
        expect(known.has(device.id), `${factory}: ${device.id}`).toBe(true)
      }
    }
  })

  it('공장 요약(관제 좌측 목록)과 본문 대수가 어긋나지 않는다', () => {
    for (const factory of outfittingFactoryNames()) {
      const summary = deviceSummaryOf(factory)
      const devices = outfittingDevices(factory)
      expect(summary.total).toBe(devices.length)
      expect(summary.online).toBe(devices.filter((d) => d.status === 'online').length)
      expect(summary.issues).toBe(devices.filter((d) => d.status !== 'online').length)
    }
  })

  it('두 화면이 같은 셀 문법으로 그린다 — 페어 한 칸까지 같다', () => {
    const factory = 'POS 1공장'
    const ids = YARD_EQUIPMENT.filter((e) => e.factory === factory).map((e) => e.id)
    const snapshot = buildEquipmentStatusSnapshot(ids, NOW)
    const devices = outfittingDevices(factory)
    const options = {
      freshTextOf: () => '방금',
      tiltOf: (device: (typeof devices)[number]) => tiltDetailOf(device, snapshot),
    }
    const a = outfittingCells(devices, options)
    const b = outfittingCells(devices, options)
    expect(a.map((c) => [c.id, c.severity])).toEqual(b.map((c) => [c.id, c.severity]))
    /* 틸팅은 라이다 셀 안에 접혀 있다 — 두 화면 모두 */
    expect(a.filter((c) => c.typeId === 'TILT')).toHaveLength(0)
  })
})
