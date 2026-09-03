import { fetchOutfittingWipBlocks } from '../../../model/processRegistry'
import type { OutfittingWipBlock } from '../../../model/processModule'
import type { AssyMatchState } from '../model/types'

/*
 * 통합실적 **의장 레일**의 데이터 (W7-11, 사용자 확정).
 *
 * 의장은 지금까지 통합실적에서 '절점 없음' 자리로만 있었다. 실제로 절점이 없는 것은 맞다 —
 * 가공의 S1~S5, 도장의 S/P→T/UP→FINAL 같은 통과 지점이 의장에는 없고 설치 판별 단건 수집이
 * 전부다. 하지만 **진척 자체는 있다**(라이다 기반 %). 그래서 절점만 생략하고 카드는 세운다.
 *
 * 규칙 셋 (사용자 확정):
 *  ① **절점 생략** — 단계 분해를 만들지 않는다. 없는 것을 있는 것처럼 그리지 않는다.
 *  ② **판별 실적 = 블록 단위 %** — 계층(대조·중조·소조)이 없다. 조립의 어휘가 흘러들지
 *     않게 이 파일도 블록만 다룬다.
 *  ③ **W/O 는 참고** — 조립 카드가 쓰는 매칭 배지 문법을 그대로 빌린다.
 *
 * ⚠️ **수치를 여기서 만들지 않는다.** 의장 공장 화면이 쓰는 그 값을 레지스트리로 읽어 온다
 *    (연계 매트릭스 원칙). 화면마다 제 해시로 진척을 지어내면 같은 블록이 두 숫자를 갖는다.
 */

/** 문자열 해시 — 레포의 다른 결정론 생성기와 같은 문법 */
function hashOf(text: string): number {
  let h = 0
  for (let i = 0; i < text.length; i += 1) h = (h * 31 + text.charCodeAt(i)) | 0
  return Math.abs(h)
}

/** 의장 카드 한 줄 — 블록 하나 */
export interface OutfittingRow extends OutfittingWipBlock {
  /** `{projNo}-{blockNo}` — 목록 key 이자 통합실적 조회 키 */
  key: string
  /**
   * 레거시 의장 오더의 매칭 상태 — **참고**다. 조립과 같은 세 갈래를 쓴다:
   * 붙었다(matched) / 계획 풀에서 찾았다(fallback) / 없다(unmatched).
   * 판별이 원천이고 오더는 그 위의 주석이라는 방향도 조립과 같다.
   */
  orderMatch: AssyMatchState
}

/**
 * 의장 오더 매칭 — **가볍게 둔다.**
 *
 * 의장 오더의 실제 테이블·키 체계는 아직 확정되지 않았다(도장의 YPWP720M 같은 명세가
 * 없다). 그래서 상태 세 갈래만 결정론으로 내고 그 이상은 만들지 않는다 — 명세가 오기 전에
 * 필드를 지어 두면, 실연동 때 그 모양에 화면이 묶인다.
 *
 * 아직 판별이 시작되지 않은 블록(진척 0)은 붙을 실적이 없으므로 매칭을 묻지 않는다.
 */
function orderMatchOf(block: OutfittingWipBlock): AssyMatchState {
  if (block.judgedRate <= 0) return 'matched' // 아직 실적이 없다 — 불일치라 부를 것도 없다
  const roll = hashOf(`${block.projNo}-${block.blockNo}-ofit-order`) % 100
  if (roll < 8) return 'unmatched' // 8% — 판별 O / 레거시 X
  if (roll < 26) return 'fallback' // 18% — 계획 풀에서 찾음
  return 'matched'
}

/** 의장 레일 전체 — 공장·블록 순 */
export async function fetchOutfittingRows(baseDate?: string): Promise<OutfittingRow[]> {
  const blocks = await fetchOutfittingWipBlocks(baseDate)
  return blocks
    .map((block) => ({
      ...block,
      key: `${block.projNo}-${block.blockNo}`,
      orderMatch: orderMatchOf(block),
    }))
    .sort((a, b) => a.factoryId.localeCompare(b.factoryId) || a.key.localeCompare(b.key))
}

/** 조회한 블록들 중 의장에 있는 것만 — 통합실적은 고른 호선·블록을 본다 */
export function rowsOfQuery(
  rows: readonly OutfittingRow[],
  projNo: string,
  blockNos: readonly string[]
): OutfittingRow[] {
  const wanted = new Set(blockNos)
  return rows.filter(
    (row) => row.projNo === projNo && (wanted.size === 0 || wanted.has(row.blockNo))
  )
}

/** 한 블록의 의장 줄 — 헤더 카드가 그 블록의 의장 진척을 적을 때. 없으면 null */
export function rowOfBlock(
  rows: readonly OutfittingRow[],
  projNo: string,
  blockNo: string
): OutfittingRow | null {
  return rows.find((row) => row.projNo === projNo && row.blockNo === blockNo) ?? null
}

/** 의장 레일의 종합 — 카드 머리의 게이지 하나 */
export interface OutfittingOverall {
  /** 블록 수 = 분모. 0 이면 종합을 말하지 않는다 */
  blockCount: number
  /**
   * 종합 판별률(%) — **블록 단순 평균**이다.
   *
   * 가중을 하지 않는 이유는 **가중치로 쓸 물량이 없기 때문**이다. 가공은 부재 중량,
   * 도장은 작업면적이 있어 가중 평균이 서지만, 의장 블록에는 그런 값이 데이터에 없다.
   * 없는 가중치를 블록 크기 추정 같은 것으로 지어내면 그게 곧 임의 합성 산식이고,
   * 이 화면이 처음부터 금지한 것이다(정의서 D3 — 절점·실측 기반 %만).
   *
   * 그래서 단순 평균을 쓰되 **분모(블록 수)를 화면에 함께 낸다** — 세 블록의 평균과
   * 서른 블록의 평균이 같은 무게로 읽히지 않게.
   */
  judgedRate: number
  /** 진행 중 블록 수 */
  inProgress: number
  /** 완료 블록 수 */
  completed: number
  /** 갓 반입 블록 수 — 진척 0 이 정상인 블록들 */
  justArrived: number
}

export function overallOf(rows: readonly OutfittingRow[]): OutfittingOverall {
  if (rows.length === 0) {
    return { blockCount: 0, judgedRate: 0, inProgress: 0, completed: 0, justArrived: 0 }
  }
  const sum = rows.reduce((acc, row) => acc + row.judgedRate, 0)
  return {
    blockCount: rows.length,
    judgedRate: Math.round((sum / rows.length) * 10) / 10,
    inProgress: rows.filter((row) => row.status === 'in_progress').length,
    completed: rows.filter((row) => row.status === 'completed').length,
    justArrived: rows.filter((row) => row.justArrived).length,
  }
}
