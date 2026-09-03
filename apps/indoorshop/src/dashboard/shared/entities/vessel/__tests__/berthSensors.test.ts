import { describe, expect, it } from 'vitest'
import { listBlocks } from '../lib/roster'
import { YARD_EQUIPMENT } from '../../equipment'

/*
 * 데모 블록의 정반에는 라이다가 **실재**해야 한다 (R9 시연 품질).
 *
 * 정반 배정은 로스터가, 라이다 배치는 설비 fixture(Network Panel 도면)가 정한다 —
 * 서로 다른 원천이라 어긋날 수 있고, 실제로 어긋났었다: CAD 데모 블록 2540-281·
 * 2543-642 가 도면상 라이다가 없는 PBS 1·2BAY 에 앉아 있어, 시연 헤드라인 베이가
 * '센서 0대'로 보였다(mock 은 없는 센서를 지어내지 않는다 — 그 원칙은 옳다).
 *
 * 그래서 배정 쪽이 도면을 따라야 한다: **정반이 정해진 블록의 (공장, 베이)에는
 * 설비 fixture 의 LIDAR 가 하나 이상 서 있어야 한다.** 도면 개정으로 fixture 를
 * 다시 구우면 이 테스트가 배정과 함께 어긋난 자리를 짚는다.
 */

/** 정반이 정해진 블록 — CAD 데모 다섯이 곧 시연 헤드라인이다 */
const berthed = listBlocks().filter((block) => block.berth)

/**
 * 실측 스캔 전용 베이 — PBS 5BAY 는 실측 점군(5510 호선)이 차지하므로 mock 정반
 * 배정이 들어가면 안 된다. shared 는 processes 를 import 할 수 없어(모듈 경계)
 * `realScanData.REAL_LOCATION_ID` 를 문자열 계약으로 적는다(로스터의 공장 id 와
 * 같은 방식) — 어긋나면 조립 쪽 테스트가 잡는다.
 */
const REAL_SCAN_BAY_ID = 'asm-pbs-b5'

describe('정반 배정 ↔ 설비 도면 정합 (시연 헤드라인 베이에 센서가 있어야 한다)', () => {
  it('정반 블록이 있고, 전부 CAD 데모 블록이다 (표본이 비면 계약이 헛돈다)', () => {
    expect(berthed.length).toBeGreaterThan(0)
    for (const block of berthed) {
      expect(block.berth!.hasCadModel, `${block.projNo}-${block.blockNo}`).toBe(true)
    }
  })

  it('정반이 정해진 블록의 (공장, 베이)에는 라이다가 하나 이상 실재한다', () => {
    for (const block of berthed) {
      const lidars = YARD_EQUIPMENT.filter(
        (equipment) =>
          equipment.typeId === 'LIDAR' &&
          equipment.factory === block.factory &&
          equipment.bay === block.mapBay
      )
      expect(
        lidars.length,
        `${block.projNo}-${block.blockNo} 의 정반(${block.factory} ${block.mapBay}BAY)에 라이다가 없다 — 시연 베이가 '센서 0대'로 보인다`
      ).toBeGreaterThan(0)
    }
  })

  it('실측 스캔 베이(PBS 5BAY)에는 mock 정반 배정이 들어가지 않는다', () => {
    for (const block of berthed) {
      expect(
        block.berth!.bayId,
        `${block.projNo}-${block.blockNo} 이 실측 베이를 침범한다 — fetchLocations 가 그 칸을 실측으로 교체해 배정이 사라진다`
      ).not.toBe(REAL_SCAN_BAY_ID)
    }
  })
})
