import { describe, expect, it } from 'vitest'
import { buildYardFactoryLayout } from '../../../../shared/features/bay-viewer/lib/bayLayout'
import type { Location } from '../../../../shared/entities/location/model/types'

/*
 * 실형상 배치(yard-fixture) 파생 — 조립 공장명(PBS·GBS)으로 지번 fixture 를 찾는
 * 조립 소비 계약이다. 빌더 자체는 shared(bay-viewer)로 승격되어 공정을 모른다 —
 * 공장명·정반 id 규약(`-b{N}`)을 넘기는 쪽이 공정이다.
 */

const loc = (factoryId: string, bayNo: number): Location => ({
  id: `${factoryId}-b${bayNo}`,
  factoryId,
  name: `${bayNo}번 베이`,
  status: 'unknown',
  workCntr: `B${bayNo}`,
})

/**
 * 실형상 배치 파생 — 목업 30×70 상자가 아니라 **실제 베이 치수·모양**이 나와야 한다.
 * fixture 가 바뀌어 어긋나면 여기서 잡는다(치수는 bays.js 파생값 기준 허용오차로
 * 잡는다 — 정확값 고정은 fixture 재생성마다 깨진다).
 */
describe('buildYardFactoryLayout — 실형상 배치 파생', () => {
  it('PBS 는 8베이 실형상 — 5BAY 는 237.6×45.1m 급, 길이가 폭보다 길다', async () => {
    const layout = await buildYardFactoryLayout(
      'asm-pbs',
      'PBS',
      Array.from({ length: 8 }, (_, i) => loc('asm-pbs', i + 1))
    )
    expect(layout).not.toBeNull()
    expect(layout!.source).toBe('yard-fixture')
    expect(layout!.bays).toHaveLength(8)

    const bay5 = layout!.bays.find((b) => b.bayId === 'asm-pbs-b5')!
    expect(bay5.size[0]).toBeGreaterThan(35) // 폭 ~45m
    expect(bay5.size[0]).toBeLessThan(60)
    expect(bay5.size[1]).toBeGreaterThan(200) // 길이 ~237m
    expect(bay5.size[1]).toBeLessThan(280)
    expect(bay5.footprint!.length).toBeGreaterThanOrEqual(4)

    for (const bay of layout!.bays) {
      /* 길이(z)가 폭(x)보다 길다 — 축 정렬 규약 */
      expect(bay.size[1]).toBeGreaterThan(bay.size[0])
    }
    /* PBS 는 본동 6 스팬이 나란하고, 꺾인 별동(7·8)이 직교로 붙는다 — 실제 기하가
     * 그렇다(bays.test 의 '본동 6 + 꺾인 별동 2'). 본동은 공장 축과 거의 평행해야 한다 */
    const straight = layout!.bays.filter((b) => Math.abs(b.rotationDeg) < 15)
    expect(straight.length).toBeGreaterThanOrEqual(6)
  })

  it('PBS 5BAY 센서는 설비 실좌표 12자리 — 베이 범위 안', async () => {
    const layout = await buildYardFactoryLayout(
      'asm-pbs',
      'PBS',
      Array.from({ length: 8 }, (_, i) => loc('asm-pbs', i + 1))
    )
    const bay5 = layout!.bays.find((b) => b.bayId === 'asm-pbs-b5')!
    expect(bay5.sensorPoints).toHaveLength(12)
    for (const [x, z] of bay5.sensorPoints!) {
      expect(Math.abs(x)).toBeLessThan(bay5.size[0] / 2 + 10)
      expect(Math.abs(z)).toBeLessThan(bay5.size[1] / 2 + 10)
    }
  })

  it('GBS 3베이도 실형상으로 선다', async () => {
    const layout = await buildYardFactoryLayout(
      'asm-gbs',
      'GBS',
      Array.from({ length: 3 }, (_, i) => loc('asm-gbs', i + 1))
    )
    expect(layout?.source).toBe('yard-fixture')
    expect(layout?.bays).toHaveLength(3)
  })

  it('fixture 에 없는 공장·베이는 null — 호출부가 목업으로 폴백한다', async () => {
    expect(await buildYardFactoryLayout('asm-unknown', 'UNKNOWN', [loc('asm-unknown', 1)])).toBeNull()
    expect(await buildYardFactoryLayout('asm-pbs', 'PBS', [loc('asm-pbs', 99)])).toBeNull()
  })
})
