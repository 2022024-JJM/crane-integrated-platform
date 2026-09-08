import { describe, expect, it } from 'vitest'
import { detectionForBlockKey } from '../../../features/bay-viewer/model/lidarBlock'
import type { LidarBlockInfo } from '../../../features/bay-viewer/model/lidarBlock'
import { listBlocks } from '../lib/roster'
import { pcdHrefOfAssy, pcdHrefOfOutfittingBlock, PCD_BLOCK_PARAM } from '../lib/roster'
import { VIEWER_TAB, WORKSPACE_TAB_PARAM } from '../../../lib/workspaceTabUrl'

/**
 * 통합실적 → PCD 뷰 다리 (W8-3) — **링크 URL = 로스터 소재** 계약.
 *
 * 이 링크가 소재와 어긋나면 사용자는 엉뚱한 정반에 내려선다. 로스터 전수를 돌며
 * 소재가 있는 항목은 정확히 그 자리로, 모르는 항목은 null(버튼 없음)임을 잠근다.
 *
 * 경로에는 **착지 탭**(`&tab=viewer`, R28)도 실린다 — 'PCD 뷰' 라는 이름의 문이
 * 3D 가 아닌 축에 내려앉지 않게 하는 부분이다. 여기서는 URL 이 그 말을 하는지까지만
 * 보고, 도착 화면이 실제로 3D 탭에 서는지는 워크스페이스 테스트가 본다.
 */
const TAB_Q = `&${WORKSPACE_TAB_PARAM}=${VIEWER_TAB}`

describe('pcdHrefOfAssy — 조립 ASSY 의 소재 정반', () => {
  it('흩어진 ASSY 는 제 자리(placement.berth)로 간다 — 블록 자리가 아니다', () => {
    let checked = 0
    for (const block of listBlocks()) {
      for (const unit of block.assyUnits ?? []) {
        const href = pcdHrefOfAssy(unit.assyNo)
        if (unit.zone !== 'assembly' || !unit.berth) {
          expect(href, unit.assyNo).toBeNull()
          continue
        }
        expect(href, unit.assyNo).toBe(
          `/indoorshop/zones/assembly/${unit.berth.factoryId}/${unit.berth.bayId}?${PCD_BLOCK_PARAM}=${block.projNo}-${block.blockNo}${TAB_Q}`
        )
        checked += 1
      }
    }
    expect(checked).toBeGreaterThan(0)
  })

  it('흩어짐 없는 블록의 ASSY 는 블록 정반으로 — 정반 미상·조립 밖이면 null', () => {
    for (const block of listBlocks()) {
      if (block.assyUnits) continue
      /* 합성 ASSY 번호 — 통합실적이 만드는 문법 그대로 ({proj}-{blk}-{급+번호}) */
      const href = pcdHrefOfAssy(`${block.projNo}-${block.blockNo}-S01`)
      if (block.zone === 'assembly' && block.berth) {
        expect(href, `${block.projNo}-${block.blockNo}`).toBe(
          `/indoorshop/zones/assembly/${block.berth.factoryId}/${block.berth.bayId}?${PCD_BLOCK_PARAM}=${block.projNo}-${block.blockNo}${TAB_Q}`
        )
      } else {
        expect(href, `${block.projNo}-${block.blockNo}`).toBeNull()
      }
    }
  })

  it('로스터 밖 ASSY 는 null — 갈 곳을 지어내지 않는다', () => {
    expect(pcdHrefOfAssy('9999-999-S01')).toBeNull()
    expect(pcdHrefOfAssy('말도안됨')).toBeNull()
  })
})

describe('pcdHrefOfOutfittingBlock — 의장 블록의 소재 베이', () => {
  it('의장 블록 전수 — 베이를 아는 블록만 W7-10 베이 라우트로 간다', () => {
    let linked = 0
    let unplaced = 0
    for (const block of listBlocks()) {
      const href = pcdHrefOfOutfittingBlock(block.projNo, block.blockNo)
      if (block.zone !== 'outfitting') {
        expect(href, `${block.projNo}-${block.blockNo}: 의장 밖`).toBeNull()
        continue
      }
      if (!block.outfitting || !block.mapBay) {
        expect(href, `${block.projNo}-${block.blockNo}: 베이 미상`).toBeNull()
        unplaced += 1
        continue
      }
      const factoryId = block.outfitting.factoryId
      expect(href).toBe(
        `/indoorshop/zones/outfitting/${factoryId}/${factoryId}-b${block.mapBay}?${PCD_BLOCK_PARAM}=${block.projNo}-${block.blockNo}${TAB_Q}`
      )
      linked += 1
    }
    expect(linked).toBeGreaterThan(0)
    /* 베이 미상 표본(8103-157)이 실존한다 — 버튼이 접히는 갈래가 죽은 코드가 아니다 */
    expect(unplaced).toBeGreaterThan(0)
  })
})

describe('detectionForBlockKey — 도착 화면의 선택 승계', () => {
  const detection = (projNo: string, blkNo: string, id: string): LidarBlockInfo =>
    ({ id, projNo, blkNo }) as LidarBlockInfo

  it('승계 키와 같은 블록의 첫 detection 을 고른다', () => {
    const blocks = [
      detection('2543', '999', 'a'),
      detection('2543', '642', 'b'),
      detection('2543', '642', 'c'),
    ]
    expect(detectionForBlockKey(blocks, '2543-642')?.id).toBe('b')
  })

  it('없으면 null — 승계는 조용히 접힌다', () => {
    expect(detectionForBlockKey([detection('1', '2', 'a')], '3-4')).toBeNull()
    expect(detectionForBlockKey([], '3-4')).toBeNull()
    expect(detectionForBlockKey([detection('1', '2', 'a')], null)).toBeNull()
  })
})
