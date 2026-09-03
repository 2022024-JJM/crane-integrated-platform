import type { OutfittingWipBlock } from '../../../shared/model/processModule'
import { todayString } from '../../../shared/lib/timeAxis'
import { outfittingBlocksAt } from './mockOutfittingData'

/*
 * 의장 **재공 블록의 판별 축** — 통합실적과 공장 화면이 **같은 함수**를 지난다 (W8-4).
 *
 * W7-11 에서 통합실적 의장 레일을 세울 때 이 사상(진척 → 판별률)을 `module.ts` 의 provides
 * 안에 인라인으로 두었다. 그때는 소비자가 하나였으니 그래도 됐는데, 이제 공장 화면에도
 * 같은 구획이 서면서 소비자가 둘이 됐다. 사상이 두 곳에 복사되면 한쪽만 고쳐지는 날이
 * 오고, 그날부터 두 화면이 같은 블록을 두고 다른 %를 말한다 — 연계 매트릭스가 잡은 바로
 * 그 병이다. 그래서 사상을 여기 한 곳으로 모은다.
 *
 * `provides.outfittingBlocks` 와 공장 화면의 '진행중 판별' 구획이 **둘 다 이 함수를 부른다.**
 * 재계산은 없다 — 여기서 하는 것은 이름 붙이기(진척 → 판별률)뿐이고, 값 자체는 의장
 * 블록 mock 이 만든 그대로다.
 */

/** 기준일의 의장 재공 블록 — 통합실적·공장 화면이 함께 읽는 형태 */
export function outfittingWipBlocksAt(baseDate: string = todayString()): OutfittingWipBlock[] {
  return outfittingBlocksAt(baseDate).map((block) => ({
    projNo: block.projNo,
    blockNo: block.blkNo,
    factoryId: block.factoryId,
    areaName: block.areaName,
    wstgCode: block.wstgCode,
    /* 화면이 '진척' 이라 부르던 값이 곧 라이다 판별률이다 — 이름만 축에 맞춘다 */
    judgedRate: block.progress,
    status: block.status,
    justArrived: block.justArrived,
  }))
}

/** 공장 하나의 재공 블록 */
export function outfittingWipBlocksOfFactory(
  factoryId: string,
  baseDate?: string
): OutfittingWipBlock[] {
  return outfittingWipBlocksAt(baseDate).filter((block) => block.factoryId === factoryId)
}

/**
 * **지금 판별이 돌고 있는 블록만** — 공장 현황의 '진행중 판별' 구획이 쓰는 렌즈.
 *
 * 완료된 블록은 판별이 끝났고, 대기(갓 반입 포함)는 아직 시작하지 않았다. 둘 다 그 공장에
 * 있다는 사실은 **블록 목록**이 이미 말하므로 여기서 되풀이하지 않는다 — 이 구획이 답하는
 * 질문은 "지금 무엇이 돌고 있나" 하나다.
 *
 * 정렬은 진척이 높은 것부터 — 곧 끝날 것이 위로 온다(조립 '진행중 판별' 과 같은 규칙).
 */
export function judgingBlocksOfFactory(
  factoryId: string,
  baseDate?: string
): OutfittingWipBlock[] {
  return outfittingWipBlocksOfFactory(factoryId, baseDate)
    .filter((block) => block.status === 'in_progress')
    .sort(
      (a, b) =>
        b.judgedRate - a.judgedRate ||
        `${a.projNo}-${a.blockNo}`.localeCompare(`${b.projNo}-${b.blockNo}`)
    )
}
