import { assyFocusLinkFor, listBlocks, type RosterBlock } from '../../../shared/entities/vessel'
import { fetchAssemblySummary } from '../../../shared/features/performance/api/performanceApi'
import type { AssyTier } from '../../../shared/features/performance/model/types'
import { assemblyFactoryIdOf } from './mapEntry'

/*
 * **이 공장에서 지금 판별 중인 ASSY** (W7-7-5, 사용자 R15).
 *
 * 통합실적의 판별 내역 중 **완료분은 공장 현황에 없는 게 맞다** — 다 만든 덩어리는 그
 * 공장을 떠났기 때문이다. 그런데 **진행 중인 것은 물리적으로 아직 그 공장에 있다.** 지금은
 * 그 사실이 통합실적에만 있어서, 공장 화면에서 "여기서 지금 뭘 붙이고 있나" 를 물으면
 * 답이 없다.
 *
 * 두 원천을 잇기만 한다(연계 매트릭스 원칙 — **신원은 로스터, 실적은 통합실적**):
 *   · **어디에 있나** — 로스터. 흩어진 블록은 ASSY 마다 제 자리를 갖고(`assyUnits`),
 *     그렇지 않은 블록은 블록의 자리가 곧 ASSY 의 자리다.
 *   · **얼마나 됐나** — `fetchAssemblySummary`. 여기서 판별을 **다시 만들지 않는다.**
 *
 * 두 가지를 지킨다:
 *  · **진행 중만.** `judged === 'partial'` — 완료(떠났다)도 미착수(아직 아니다)도 아니다.
 *  · **자기율만.** 하위를 합산한 롤업률을 쓰지 않는다(R1 계층 금지). 이 화면이 묻는 것은
 *    "이 덩어리 하나가 얼마나 됐나" 이고, 롤업은 대조 아래 소조까지 섞어 그 질문을 흐린다.
 */

/** 이 공장에서 판별 중인 ASSY 한 줄 */
export interface JudgingAssy {
  projNo: string
  blockNo: string
  /** `{projNo}-{blockNo}` — 목록 key 이자 통합실적 조회 키 */
  blockKey: string
  assyNo: string
  tier: AssyTier
  /** 자기 단독 판별률(%) — 롤업이 아니다 */
  selfRate: number
  recognizedQty: number
  reqQty: number
  /** 로스터가 적어 둔 이 ASSY 의 자리 — 지도 베이 이름(없을 수 있다) */
  mapBay: string | null
  /** 통합실적 딥링크 — `?vessel=&block=&assy=` */
  href: string
}

/**
 * 이 ASSY 가 서 있는 **지도 공장명**.
 *
 * 흩어진 블록(`assyUnits`)은 ASSY 마다 자리가 다르다 — 소조 공장에서 소조를 붙여 중조
 * 공장으로 보내고 대조 정반에서 합치므로, 한 블록의 ASSY 가 여러 공장에 동시에 있다.
 * 흩어짐이 적히지 않은 블록은 블록의 자리가 곧 그 ASSY 들의 자리다.
 */
function assyPlacementOf(
  block: RosterBlock,
  assyNo: string
): { factory: string; mapBay: string | null } {
  const unit = block.assyUnits?.find((u) => u.assyNo === assyNo)
  if (unit) return { factory: unit.factory, mapBay: unit.mapBay ?? null }
  return { factory: block.factory, mapBay: block.mapBay ?? null }
}

/** 정렬 — 진척이 높은 것부터(곧 끝날 것이 위), 같으면 ASSY 번호 순 */
function byProgress(a: JudgingAssy, b: JudgingAssy): number {
  return b.selfRate - a.selfRate || a.assyNo.localeCompare(b.assyNo)
}

/**
 * 조립 공장 하나에서 지금 판별 중인 ASSY 전부.
 *
 * `factoryId` 는 조립 공장 fixture 의 id(`asm-pbs`) — 화면 라우트가 쓰는 그 값이다.
 * 로스터의 자리는 지도 공장명이라 `assemblyFactoryIdOf` 로 옮겨 맞춘다.
 */
export async function judgingAssysAt(
  factoryId: string,
  baseDate: string
): Promise<JudgingAssy[]> {
  const rows: JudgingAssy[] = []
  for (const block of listBlocks()) {
    /* 가공 중인 블록은 조립 판별이 아직 없다 — 부르지 않고 건너뛴다 */
    if (block.zone === 'fabrication') continue
    const summary = await fetchAssemblySummary(block.projNo, block.blockNo, baseDate)
    for (const assy of summary.assys) {
      /* 진행 중만 — 완료는 떠났고 미착수는 아직이다 */
      if (assy.judged !== 'partial') continue
      const placement = assyPlacementOf(block, assy.assyNo)
      if (assemblyFactoryIdOf(placement.factory) !== factoryId) continue
      rows.push({
        projNo: block.projNo,
        blockNo: block.blockNo,
        blockKey: `${block.projNo}-${block.blockNo}`,
        assyNo: assy.assyNo,
        tier: assy.tier,
        selfRate: assy.selfRate,
        recognizedQty: assy.recognizedQty,
        reqQty: assy.reqQty,
        mapBay: placement.mapBay,
        /* 링크 재료도 우리가 짜지 않는다 — 딥링크 문법은 엔티티가 소유한다 */
        href: assyFocusLinkFor([assy.assyNo]) ?? '/indoorshop/performance',
      })
    }
  }
  return rows.sort(byProgress)
}
